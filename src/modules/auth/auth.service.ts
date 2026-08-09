import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private mailerTransport: nodemailer.Transporter | null = null;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  // ─── Mailer (lazy init) ────────────────────────────────────────
  private async getMailer(): Promise<nodemailer.Transporter> {
    if (this.mailerTransport) return this.mailerTransport;

    const host = this.config.get('MAIL_HOST');
    const user = this.config.get('MAIL_USER');
    const pass = this.config.get('MAIL_PASS');

    // Auto-create Ethereal test account if no creds provided
    if (!user || !pass) {
      const testAccount = await nodemailer.createTestAccount();
      this.mailerTransport = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      console.log('📧 Ethereal test account:', testAccount.user);
      return this.mailerTransport;
    }

    const port = this.config.get<number>('MAIL_PORT', 587);
    this.mailerTransport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for other ports
      auth: { user, pass },
    });
    return this.mailerTransport;
  }

  // ─── Token Generators ─────────────────────────────────────────
  private generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_EXPIRATION', '15m'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRATION', '7d'),
    });

    return { accessToken, refreshToken };
  }

  private async hashRefreshToken(token: string): Promise<string> {
    return bcrypt.hash(token, 10);
  }

  // ─── Signup ───────────────────────────────────────────────────
  async signup(dto: SignupDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const rounds = this.config.get<number>('BCRYPT_ROUNDS', 12);
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        passwordHash,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    const { accessToken, refreshToken } = this.generateTokens(
      user.id,
      user.email,
      user.role,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: await this.hashRefreshToken(refreshToken) },
    });

    // Send welcome email asynchronously so it doesn't block signup
    this.sendWelcomeEmail(user.email, user.fullName).catch(err => {
      console.error('Failed to send welcome email:', err);
    });

    return { user, accessToken, refreshToken };
  }

  // ─── Email Sender Wrapper ─────────────────────────────────────
  private async sendMailViaHttpOrSmtp(to: string, subject: string, html: string) {
    const host = this.config.get('MAIL_HOST');
    const user = this.config.get('MAIL_USER');
    const pass = this.config.get('MAIL_PASS');
    const from = this.config.get('MAIL_FROM', 'noreply@pakverse.pk');

    // Mailgun HTTP API Fallback (Bypasses Railway SMTP Block)
    if (host && host.includes('mailgun')) {
      const domain = user.split('@')[1];
      const formData = new URLSearchParams();
      formData.append('from', from);
      formData.append('to', to);
      formData.append('subject', subject);
      formData.append('html', html);

      const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`api:${pass}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        throw new Error(`Mailgun API error: ${await response.text()}`);
      }
      return;
    }

    // Standard SMTP
    const mailer = await this.getMailer();
    const info = await mailer.sendMail({ from, to, subject, html });
    if (process.env.NODE_ENV !== 'production') {
      console.log('📧 Email preview:', nodemailer.getTestMessageUrl(info));
    }
  }

  // ─── Welcome Email ────────────────────────────────────────────
  private async sendWelcomeEmail(email: string, fullName: string) {
    try {
      const loginUrl = `${this.config.get('FRONTEND_URL')}/login`;
      await this.sendMailViaHttpOrSmtp(
        email,
        'Welcome to PakVerse! 🚀',
        `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <h2 style="color:#0ea5e9">Welcome to PakVerse!</h2>
            <p>Hi ${fullName},</p>
            <p>Thank you for creating an account on PakVerse. We're thrilled to have you join our community!</p>
            <p>You can now explore the marketplace, find educational courses, and connect with people from all across the country.</p>
            <a href="${loginUrl}" style="display:inline-block;padding:12px 24px;background:#0ea5e9;color:white;text-decoration:none;border-radius:8px;margin:16px 0">
              Go to Login
            </a>
            <p>If you have any questions, feel free to reach out to our support team.</p>
            <hr/>
            <small style="color:#888">PakVerse Portal — Pakistan's community platform</small>
          </div>
        `
      );
    } catch (error) {
      console.error('Welcome email send failed:', error);
    }
  }

  // ─── Login ────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { accessToken, refreshToken } = this.generateTokens(
      user.id,
      user.email,
      user.role,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshTokenHash: await this.hashRefreshToken(refreshToken),
        isOnline: true,
        lastActive: new Date(),
      },
    });

    const { passwordHash, refreshTokenHash, resetToken, resetTokenExpiry, ...safeUser } = user;

    return { user: safeUser, accessToken, refreshToken };
  }

  // ─── Refresh Token ────────────────────────────────────────────
  async refreshTokens(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Access denied');
    }

    const { accessToken, refreshToken } = this.generateTokens(
      user.id,
      user.email,
      user.role,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: await this.hashRefreshToken(refreshToken) },
    });

    return { accessToken, refreshToken };
  }

  // ─── Logout ───────────────────────────────────────────────────
  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null, isOnline: false },
    });
    return { message: 'Logged out successfully' };
  }

  // ─── Forgot Password ──────────────────────────────────────────
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) {
      return {
        message: 'If an account with that email exists, a reset link has been sent',
      };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetToken: tokenHash, resetTokenExpiry: expiry },
    });

    const resetUrl = `${this.config.get('FRONTEND_URL')}/reset-password?token=${token}`;

    try {
      await this.sendMailViaHttpOrSmtp(
        email,
        'PakVerse — Reset Your Password',
        `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <h2 style="color:#0ea5e9">PakVerse Password Reset</h2>
            <p>Hi ${user.fullName},</p>
            <p>We received a request to reset your password. Click the link below:</p>
            <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#0ea5e9;color:white;text-decoration:none;border-radius:8px;margin:16px 0">
              Reset Password
            </a>
            <p>This link expires in <strong>1 hour</strong>.</p>
            <p>If you didn't request this, you can safely ignore this email.</p>
            <hr/>
            <small style="color:#888">PakVerse Portal — Pakistan's community platform</small>
          </div>
        `
      );
    } catch (error) {
      console.error('Email send failed:', error);
    }

    return {
      message: 'If an account with that email exists, a reset link has been sent',
    };
  }

  // ─── Reset Password ───────────────────────────────────────────
  async resetPassword(token: string, newPassword: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: tokenHash,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Password reset token is invalid or expired');
    }

    const rounds = this.config.get<number>('BCRYPT_ROUNDS', 12);
    const passwordHash = await bcrypt.hash(newPassword, rounds);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
        refreshTokenHash: null, // invalidate all sessions
      },
    });

    return { message: 'Password reset successfully. Please log in with your new password.' };
  }

  // ─── Get Current User ─────────────────────────────────────────
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        avatar: true,
        coverPhoto: true,
        bio: true,
        city: true,
        website: true,
        phone: true,
        role: true,
        isVerified: true,
        isOnline: true,
        lastActive: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            shops: true,
            sentFriendRequests: { where: { status: 'ACCEPTED' } },
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}

import { PrismaClient, Role, ShopType, PostType, ListingCondition } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PAKISTANI_CITIES = [
  'Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad',
  'Multan', 'Peshawar', 'Quetta', 'Sialkot', 'Gujranwala',
  'Hyderabad', 'Abbottabad', 'Bahawalpur', 'Sargodha', 'Sukkur',
  'Larkana', 'Sheikhupura', 'Rahim Yar Khan', 'Gujrat', 'Mardan',
];

const SHOP_CATEGORIES = [
  'Electronics', 'Mobile Phones', 'Clothing & Fashion', 'Food & Restaurants',
  'Furniture', 'Books & Stationery', 'Sports & Fitness', 'Beauty & Cosmetics',
  'Automotive', 'Home Appliances', 'Agriculture', 'Jewellery',
  'Pharmacy', 'Kids & Toys', 'Construction', 'Printing & Design',
];

const HOSPITAL_SPECIALIZATIONS = [
  'Cardiology', 'Neurology', 'Orthopedics', 'General Medicine',
  'Pediatrics', 'Gynecology', 'Dermatology', 'Ophthalmology',
  'Dental', 'Oncology', 'Psychiatry', 'ENT',
];

async function main() {
  console.log('🌱 Seeding PakVerse database...\n');

  // ─── Admin User ───────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin@PakVerse123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@pakverse.pk' },
    update: {},
    create: {
      fullName: 'PakVerse Admin',
      email: 'admin@pakverse.pk',
      passwordHash: adminPassword,
      role: Role.ADMIN,
      isVerified: true,
      city: 'Islamabad',
      bio: 'PakVerse Platform Administrator',
    },
  });
  console.log(`✅ Admin user: ${admin.email}`);

  // ─── Test User ────────────────────────────────────────────────
  const userPassword = await bcrypt.hash('User@Test123', 12);
  const testUser = await prisma.user.upsert({
    where: { email: 'hammad@pakverse.pk' },
    update: {},
    create: {
      fullName: 'Hammad Khan',
      email: 'hammad@pakverse.pk',
      passwordHash: userPassword,
      role: Role.USER,
      isVerified: true,
      city: 'Lahore',
      bio: 'PakVerse Platform Developer',
    },
  });
  console.log(`✅ Test user: ${testUser.email}`);

  // ─── Sample Shops ─────────────────────────────────────────────
  const shopData = [
    {
      name: 'Khan Electronics Lahore',
      description: 'Best electronics and mobile phones shop in Lahore with warranty',
      shopType: ShopType.PRODUCT_SELLER,
      city: 'Lahore',
      categories: ['Electronics', 'Mobile Phones'],
      slug: 'khan-electronics-lahore',
      whatsappNumber: '+923001234567',
      phone: '042-1234567',
    },
    {
      name: 'Karachi Fashion Hub',
      description: 'Latest fashion trends — men, women, and kids clothing',
      shopType: ShopType.PRODUCT_SELLER,
      city: 'Karachi',
      categories: ['Clothing & Fashion'],
      slug: 'karachi-fashion-hub',
      whatsappNumber: '+923211234567',
    },
    {
      name: 'Islamabad Digital Services',
      description: 'Professional digital marketing, web design, and IT services',
      shopType: ShopType.SERVICE_PROVIDER,
      city: 'Islamabad',
      categories: ['Printing & Design'],
      slug: 'islamabad-digital-services',
      phone: '051-1234567',
    },
  ];

  for (const shop of shopData) {
    await prisma.shop.upsert({
      where: { slug: shop.slug },
      update: {},
      create: { ...shop, ownerId: admin.id, rating: 4.5, totalReviews: 12 },
    });
  }
  console.log(`✅ ${shopData.length} sample shops seeded`);

  // ─── Sample Hospital ──────────────────────────────────────────
  const hospital = await prisma.hospital.upsert({
    where: { slug: 'shaukat-khanum-lahore' },
    update: {},
    create: {
      name: 'Shaukat Khanum Memorial Hospital',
      slug: 'shaukat-khanum-lahore',
      description: 'Pakistan\'s premier cancer hospital offering world-class oncology care',
      specialization: 'Oncology',
      city: 'Lahore',
      category: 'Specialized',
      phone: '042-35945100',
      email: 'info@shaukatkhanum.org.pk',
      address: 'Johar Town, Lahore',
      emergencyService: true,
      rating: 4.9,
      doctorsCount: 150,
      bedsCount: 300,
      adminId: admin.id,
    },
  });
  console.log(`✅ Sample hospital: ${hospital.name}`);

  // ─── Sample Institute ─────────────────────────────────────────
  await prisma.institute.upsert({
    where: { slug: 'lahore-university-of-management' },
    update: {},
    create: {
      name: 'Lahore University of Management Sciences',
      slug: 'lahore-university-of-management',
      description: 'LUMS is one of Pakistan\'s leading universities offering world-class education',
      type: 'University',
      city: 'Lahore',
      location: 'Sector U, DHA, Lahore',
      phone: '042-35608000',
      email: 'admissions@lums.edu.pk',
      specialization: 'Business, Law, Science & Engineering',
      website: 'https://lums.edu.pk',
      yearEstablished: 1985,
      studentCount: '5000+',
      rating: 4.8,
      isVerified: true,
      adminId: admin.id,
    },
  });
  console.log(`✅ Sample institute seeded`);

  // ─── Sample Marketplace Listings ──────────────────────────────
  const listings = [
    {
      title: 'iPhone 14 Pro Max 256GB',
      description: 'Like new iPhone 14 Pro Max, Space Black, all accessories included',
      price: 280000,
      category: 'Mobile Phones',
      condition: ListingCondition.USED,
      city: 'Lahore',
      contactPhone: '+923001234567',
      imageUrls: [],
    },
    {
      title: 'Honda Civic 2021',
      description: 'Honda Civic Turbo 2021, excellent condition, original paint',
      price: 8500000,
      category: 'Automotive',
      condition: ListingCondition.USED,
      city: 'Karachi',
      contactPhone: '+923211234567',
      imageUrls: [],
    },
  ];

  for (const listing of listings) {
    await prisma.marketplaceListing.create({
      data: { ...listing, sellerId: testUser.id },
    }).catch(() => {}); // ignore duplicates
  }
  console.log(`✅ ${listings.length} sample marketplace listings seeded`);

  // ─── Sample Post ──────────────────────────────────────────────
  await prisma.post.create({
    data: {
      content: 'Welcome to PakVerse! 🇵🇰 Pakistan\'s first community platform for everything local. #PakVerse #Pakistan #Community',
      type: PostType.POST,
      city: 'Islamabad',
      hashtags: ['#pakverse', '#pakistan', '#community'],
      mediaUrls: [],
      authorId: admin.id,
    },
  }).catch(() => {});
  console.log(`✅ Sample post seeded`);

  console.log('\n🎉 Database seeding complete!');
  console.log('\n📝 Login credentials:');
  console.log('   Admin: admin@pakverse.pk / Admin@PakVerse123');
  console.log('   User:  hammad@pakverse.pk / User@Test123');
  console.log('\n🌐 Pakistani Cities available:', PAKISTANI_CITIES.length);
  console.log('🏪 Shop Categories available:', SHOP_CATEGORIES.length);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

const companiesCardData = [
    {
        name: 'Audio-Visual Services',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Beverage & Liquor',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'white',
    },
    {
        name: 'Bridal Shower Items',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Cakes',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'white',
    },
    {
        name: 'Car Rentals',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Catering Services',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'white',
    },
    {
        name: 'Corporate Team Building Services',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Couturiers and Shoes',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'white',
    },
    {
        name: 'Crowd Control Services',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'white',
    },
    {
        name: 'Dessert Suppliers',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'white',
    },
    {
        name: 'Desserts, Coffee, and Mobile Bars',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'yellow-400',
    },
    {
        name: 'Entertainment Agencies',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Event Cleaning Services',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Event Drone Services',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'white',
    },
    {
        name: 'Event Rental Services',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Event Security Services',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Event Technology Providers',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Exhibition Design',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Financial Services',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Fireworks / Special Effects',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Florist',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'white',
    },
    {
        name: 'Giveaways and Souvenirs',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Bridal Gown',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'white',
    },
    {
        name: 'Specialty Food Carts',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Hair and Make Up',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Honeymoon Destinations',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'white',
    },
    {
        name: 'Hosts',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Hotels',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'white',
    },
    {
        name: 'Inflatables',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Invitations & Stationery',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Jewelries',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'white',
    },
    {
        name: 'Lights & Sounds',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Meeting and Conference',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'white',
    },
    {
        name: "Men's   Toursseau",
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'white',
    },
    {
        name: 'Mobile Bar',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Musicians',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Photo & Video',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'white',
    },
    {
        name: 'Photo Booth',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Planner & Coordinators',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Real Estate',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Social Media Event Promotion Services',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Stage and Set Design Companies',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Stylist',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Transportation Services',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Travel Service',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Venues',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Wedding Accessories',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
    {
        name: 'Wedding Apparel & Wardrobes',
        imageSrc: '../../uploads/wizard/wizard.jpg',
        color: 'black',
    },
];

const companiesCardContainer = document.getElementById('companiesCardContainer');

companiesCardData.sort((a, b) => a.name.localeCompare(b.name));

companiesCardData.forEach((item) => {
    const companiesCardHtml = `
    <div class="card">
      <a href="https://allworldtrade.com/registration" target="_blank">
        <div class="relative w-full h-56 overflow-hidden rounded-md">
          <div class="absolute z-10 w-full h-3/4 -bottom-12 bg-gradient-to-b from-transparent to-gray-800"></div>
          <img src="${item.imageSrc}" class="absolute object-cover w-full h-full" alt="">
        </div>
        <p class="py-2 text-lg font-semibold text-center">${item.name}</p>
      </a>
    </div>
  `;

    companiesCardContainer.insertAdjacentHTML('beforeend', companiesCardHtml);
});

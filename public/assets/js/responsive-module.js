module.exports = {
    theme: {
        screens: {
            sm: '640px',
            // => @media (min-width: 640px) { ... }

            md: '768px',
            // => @media (min-width: 768px) { ... }

            lg: '1024px',
            // => @media (min-width: 1024px) { ... }

            xl: '1280px',
            // => @media (min-width: 1280px) { ... }

            '2xl': '1536px',
            // => @media (min-width: 1536px) { ... }
        },
    },
};

module.exports = {
    theme: {
        screens: {
            sm: '576px',
            // => @media (min-width: 576px) { ... }

            md: '960px',
            // => @media (min-width: 960px) { ... }

            lg: '1440px',
            // => @media (min-width: 1440px) { ... }
        },
    },
};

module.exports = {
    theme: {
        extend: {
            screens: {
                lg: '992px',
                // => @media (min-width: 992px) { ... }
            },
        },
    },
};

module.exports = {
    theme: {
        extend: {
            screens: {
                '3xl': '1600px',
            },
        },
    },
    variants: {},
    plugins: [],
};

const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
    theme: {
        screens: {
            xs: '475px',
            ...defaultTheme.screens,
        },
    },
    variants: {},
    plugins: [],
};

module.exports = {
    theme: {
        screens: {
            tablet: '640px',
            // => @media (min-width: 640px) { ... }

            laptop: '1024px',
            // => @media (min-width: 1024px) { ... }

            desktop: '1280px',
            // => @media (min-width: 1280px) { ... }
        },
    },
};

module.exports = {
    theme: {
        screens: {
            '2xl': { max: '1535px' },
            // => @media (max-width: 1535px) { ... }

            xl: { max: '1279px' },
            // => @media (max-width: 1279px) { ... }

            lg: { max: '1023px' },
            // => @media (max-width: 1023px) { ... }

            md: { max: '767px' },
            // => @media (max-width: 767px) { ... }

            sm: { max: '639px' },
            // => @media (max-width: 639px) { ... }
        },
    },
};

module.exports = {
    theme: {
        screens: {
            sm: { min: '640px', max: '767px' },
            // => @media (min-width: 640px and max-width: 767px) { ... }

            md: { min: '768px', max: '1023px' },
            // => @media (min-width: 768px and max-width: 1023px) { ... }

            lg: { min: '1024px', max: '1279px' },
            // => @media (min-width: 1024px and max-width: 1279px) { ... }

            xl: { min: '1280px', max: '1535px' },
            // => @media (min-width: 1280px and max-width: 1535px) { ... }

            '2xl': { min: '1536px' },
            // => @media (min-width: 1536px) { ... }
        },
    },
};

module.exports = {
    theme: {
        screens: {
            sm: '500px',
            md: [
                // Sidebar appears at 768px, so revert to `sm:` styles between 768px
                // and 868px, after which the main content area is wide enough again to
                // apply the `md:` styles.
                { min: '668px', max: '767px' },
                { min: '868px' },
            ],
            lg: '1100px',
            xl: '1400px',
        },
    },
};

module.exports = {
    theme: {
        extend: {
            screens: {
                tall: { raw: '(min-height: 800px)' },
                // => @media (min-height: 800px) { ... }
            },
        },
    },
};

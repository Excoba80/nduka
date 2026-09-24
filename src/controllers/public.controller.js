'use strict';

const investigationRequestService =
    require('../services/investigation-request.service');


/**
 * Format an Investigation Type price for public display.
 *
 * The underlying price remains the authoritative
 * service_price value from investigation_types.
 */
function formatPrice(amount) {

    return new Intl.NumberFormat(
        'en-NG',
        {
            style: 'currency',
            currency: 'NGN',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    ).format(Number(amount || 0));

}


/**
 * Prepare Investigation Types for public display.
 */
function prepareInvestigationTypes(investigationTypes) {

    return investigationTypes.map(
        investigationType => ({
            ...investigationType,

            formattedPrice:
                formatPrice(
                    investigationType.service_price
                )
        })
    );

}


/**
 * Display the public Investigation Services catalogue.
 *
 * Only active Investigation Types are displayed.
 */
async function services(req, res, next) {

    try {

        const investigationTypes =
            await investigationRequestService
                .getActiveInvestigationTypes();


        return res.render(
            'public/services',
            {
                title: 'Investigation Services — NDUKA',

                investigationTypes:
                    prepareInvestigationTypes(
                        investigationTypes
                    )
            }
        );

    } catch (error) {

        return next(error);

    }

}


/**
 * Display the public Investigation Services pricing.
 *
 * Prices come directly from the active Investigation
 * Type catalogue.
 */
async function pricing(req, res, next) {

    try {

        const investigationTypes =
            await investigationRequestService
                .getActiveInvestigationTypes();


        return res.render(
            'public/pricing',
            {
                title: 'Pricing — NDUKA',

                investigationTypes:
                    prepareInvestigationTypes(
                        investigationTypes
                    )
            }
        );

    } catch (error) {

        return next(error);

    }

}



/*
 * Public How It Works page
 *
 * Visitors do not need to be authenticated.
 */
const howItWorks = (req, res) => {
    res.render('public/how-it-works');
};


/*
 * Public About page
 *
 * Visitors do not need to be authenticated.
 */
const about = (req, res) => {
    res.render(
        'public/about',
        {
            title: 'About NDUKA — Marriage Intelligence & Verification'
        }
    );
};


/*
 * Public FAQ page
 *
 * Visitors do not need to be authenticated.
 */
const faq = (req, res) => {
    res.render(
        'public/faq',
        {
            title: 'FAQ — NDUKA'
        }
    );
};


/*
 * Public Contact page
 *
 * Visitors do not need to be authenticated.
 */
const contact = (req, res) => {
    res.render(
        'public/contact',
        {
            title: 'Contact NDUKA — Marriage Intelligence & Verification'
        }
    );
};

module.exports = {
    services,
    pricing,
    howItWorks,
    about,
    contact,
    faq
};

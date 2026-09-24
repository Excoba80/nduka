'use strict';

const express = require('express');

const publicController =
    require('../controllers/public.controller');


const router = express.Router();


/*
 * Public Investigation Services Catalogue
 *
 * Visitors do not need to be authenticated.
 */
router.get(
    '/services',
    publicController.services
);


/*
 * Public Investigation Services Pricing
 *
 * Visitors do not need to be authenticated.
 */
router.get(
    '/pricing',
    publicController.pricing
);



/*
 * Public How It Works page
 *
 * Visitors do not need to be authenticated.
 */
router.get(
    '/how-it-works',
    publicController.howItWorks
);


/*
 * Public About page
 *
 * Visitors do not need to be authenticated.
 */
router.get(
    '/about',
    publicController.about
);


/*
 * Public Contact page
 *
 * Visitors do not need to be authenticated.
 */
router.get(
    '/contact',
    publicController.contact
);


/*
 * Public FAQ page
 *
 * Visitors do not need to be authenticated.
 */
router.get(
    '/faq',
    publicController.faq
);

module.exports = router;

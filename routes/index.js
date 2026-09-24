'use strict';

const express = require('express');

const homeController =
    require('../controllers/homeController');

const router = express.Router();


/*
 * Public Home Page
 *
 * This route is intentionally public.
 * Visitors do not need an authenticated
 * NDUKA account to learn about the service.
 */
router.get(
    '/',
    homeController.index
);


module.exports = router;

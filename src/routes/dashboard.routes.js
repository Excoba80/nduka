
'use strict';

const express = require('express');

const router = express.Router();

const requireAuth = require('../middleware/requireAuth');

router.get(
    '/dashboard',
    requireAuth,
    (req, res) => {

        res.render('dashboard/index', {

            title: 'Dashboard'

        });

    }
);

module.exports = router;
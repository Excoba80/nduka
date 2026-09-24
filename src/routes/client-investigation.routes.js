'use strict';

const express = require('express');

const router = express.Router();

const requireAuth =
    require('../middleware/requireAuth');

const clientInvestigationController =
    require('../controllers/client-investigation.controller');


router.get(
    '/my-investigations',
    requireAuth,
    clientInvestigationController.index
);


router.get(
    '/my-investigations/:id',
    requireAuth,
    clientInvestigationController.show
);


router.get(
    '/my-investigations/:id/reports/:reportId',
    requireAuth,
    clientInvestigationController.viewReport
);


module.exports = router;
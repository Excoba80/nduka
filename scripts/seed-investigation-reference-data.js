#!/usr/bin/env node

'use strict';

require('dotenv').config();

const db = require('../src/config/database');


const investigationTypes = [
    {
        code: 'IDENTITY_VERIFICATION',
        name: 'Identity Verification',
        description: 'Verification of identity and relevant identity information.',
        displayOrder: 1
    },
    {
        code: 'MARITAL_STATUS_VERIFICATION',
        name: 'Marital Status Verification',
        description: 'Verification of current or previous marital status information.',
        displayOrder: 2
    },
    {
        code: 'ADDRESS_VERIFICATION',
        name: 'Address Verification',
        description: 'Verification of residential or other relevant address information.',
        displayOrder: 3
    },
    {
        code: 'EMPLOYMENT_VERIFICATION',
        name: 'Employment Verification',
        description: 'Verification of employment, occupation, or business information.',
        displayOrder: 4
    },
    {
        code: 'EDUCATION_VERIFICATION',
        name: 'Education Verification',
        description: 'Verification of educational qualifications and related claims.',
        displayOrder: 5
    },
    {
        code: 'LITIGATION_CHECK',
        name: 'Litigation Check',
        description: 'Review of publicly verifiable litigation and court information.',
        displayOrder: 6
    },
    {
        code: 'BACKGROUND_CHECK',
        name: 'Background Check',
        description: 'General review of publicly verifiable background information.',
        displayOrder: 7
    },
    {
        code: 'REFERENCE_CHECK',
        name: 'Reference Check',
        description: 'Verification of information supplied by references.',
        displayOrder: 8
    },
    {
        code: 'ONLINE_PRESENCE_REVIEW',
        name: 'Online Presence Review',
        description: 'Review of publicly available online information and presence.',
        displayOrder: 9
    }
];


const serviceStatuses = [
    {
        code: 'PENDING',
        name: 'Pending',
        description: 'The investigation service has been created but work has not started.',
        displayOrder: 1,
        isDefault: 1,
        isTerminal: 0
    },
    {
        code: 'IN_PROGRESS',
        name: 'In Progress',
        description: 'The investigation service is actively being worked on.',
        displayOrder: 2,
        isDefault: 0,
        isTerminal: 0
    },
    {
        code: 'ON_HOLD',
        name: 'On Hold',
        description: 'Work on the investigation service is temporarily suspended.',
        displayOrder: 3,
        isDefault: 0,
        isTerminal: 0
    },
    {
        code: 'COMPLETED',
        name: 'Completed',
        description: 'The investigation service has been completed.',
        displayOrder: 4,
        isDefault: 0,
        isTerminal: 1
    },
    {
        code: 'CANCELLED',
        name: 'Cancelled',
        description: 'The investigation service has been cancelled and cannot continue.',
        displayOrder: 5,
        isDefault: 0,
        isTerminal: 1
    }
];


async function seedReferenceData() {

    let connection;

    try {

        console.log('========================================');
        console.log('NDUKA Investigation Reference Data');
        console.log('========================================');


        connection = await db.getConnection();

        await connection.beginTransaction();


        /*
         * Seed Investigation Types.
         *
         * Existing rows are updated rather than duplicated.
         * This makes the script safe to run again.
         */

        for (const type of investigationTypes) {

            await connection.execute(
                `
                INSERT INTO investigation_types (
                    code,
                    name,
                    description,
                    display_order,
                    is_active
                )
                VALUES (?, ?, ?, ?, 1)
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    description = VALUES(description),
                    display_order = VALUES(display_order),
                    is_active = 1
                `,
                [
                    type.code,
                    type.name,
                    type.description,
                    type.displayOrder
                ]
            );
        }


        /*
         * Seed Service Statuses.
         *
         * Existing rows are updated rather than duplicated.
         */

        for (const status of serviceStatuses) {

            await connection.execute(
                `
                INSERT INTO service_statuses (
                    code,
                    name,
                    description,
                    display_order,
                    is_active,
                    is_default,
                    is_terminal
                )
                VALUES (?, ?, ?, ?, 1, ?, ?)
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    description = VALUES(description),
                    display_order = VALUES(display_order),
                    is_active = 1,
                    is_default = VALUES(is_default),
                    is_terminal = VALUES(is_terminal)
                `,
                [
                    status.code,
                    status.name,
                    status.description,
                    status.displayOrder,
                    status.isDefault,
                    status.isTerminal
                ]
            );
        }


        /*
         * Ensure only one active default service status exists.
         */

        await connection.execute(
            `
            UPDATE service_statuses
            SET is_default = 0
            WHERE code <> 'PENDING'
            `
        );

        await connection.execute(
            `
            UPDATE service_statuses
            SET is_default = 1
            WHERE code = 'PENDING'
            `
        );


        await connection.commit();


        console.log('');
        console.log(
            `Investigation types seeded: ${investigationTypes.length}`
        );

        console.log(
            `Service statuses seeded: ${serviceStatuses.length}`
        );

        console.log('');
        console.log('Reference data seeded successfully.');
        console.log('');


    } catch (error) {

        if (connection) {

            try {
                await connection.rollback();
            } catch (_) {}
        }

        console.error('');
        console.error('Reference-data seeding failed.');
        console.error(error);
        console.error('');

        process.exitCode = 1;

    } finally {

        if (connection) {
            connection.release();
        }
    }
}


seedReferenceData();

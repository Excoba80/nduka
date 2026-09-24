'use strict';

/**
 * Public investigation recommendation service.
 *
 * This is deliberately rule-based and transparent.
 * It recommends existing investigation types by their stable
 * catalogue code. It does not select services silently.
 */

const OBJECTIVES = [
    {
        key: 'identity',
        label: "I want to verify someone's identity",
        description:
            'Confirm that a person is who they claim to be.',
        codes: ['IDENTITY_VERIFICATION']
    },

    {
        key: 'marital_status',
        label: "I want to confirm someone's marital status",
        description:
            "Check a person's stated marital status.",
        codes: ['MARITAL_STATUS_VERIFICATION']
    },

    {
        key: 'address',
        label: "I want to verify someone's address",
        description:
            'Confirm where a person lives or is based.',
        codes: ['ADDRESS_VERIFICATION']
    },

    {
        key: 'employment',
        label: "I want to verify someone's employment or occupation",
        description:
            'Check employment, occupation or workplace information.',
        codes: ['EMPLOYMENT_VERIFICATION']
    },

    {
        key: 'education',
        label: "I want to verify someone's education or qualifications",
        description:
            'Confirm educational history or stated qualifications.',
        codes: ['EDUCATION_VERIFICATION']
    },

    {
        key: 'litigation',
        label: "I want to check court or litigation matters",
        description:
            'Check for relevant litigation or court matters.',
        codes: ['LITIGATION_CHECK']
    },

    {
        key: 'background',
        label: "I want a broader background check",
        description:
            'Request a broader review covering multiple background areas.',
        codes: ['BACKGROUND_CHECK']
    },

    {
        key: 'references',
        label: "I want to verify information through references",
        description:
            'Check information with relevant personal or professional references.',
        codes: ['REFERENCE_CHECK']
    },

    {
        key: 'online_presence',
        label: "I want to review someone's online presence",
        description:
            'Review publicly available online presence and information.',
        codes: ['ONLINE_PRESENCE_REVIEW']
    }
];


/**
 * Return the plain-language objectives displayed to visitors.
 *
 * The stable investigation type codes are deliberately exposed
 * so the browser can connect recommendations to the existing
 * Investigation Service catalogue without relying on numeric IDs.
 */
function getObjectives() {
    return OBJECTIVES.map((objective) => ({
        key: objective.key,
        label: objective.label,
        description: objective.description,
        codes: [...objective.codes]
    }));
}


/**
 * Recommend active investigation types for selected objectives.
 *
 * `investigationTypes` must come from the existing active catalogue.
 * The recommendation layer therefore cannot recommend an inactive
 * or unknown Investigation Type.
 */
function recommend(selectedObjectives, investigationTypes) {

    const selected =
        Array.isArray(selectedObjectives)
            ? selectedObjectives
            : [];

    const activeTypes =
        Array.isArray(investigationTypes)
            ? investigationTypes
            : [];

    const selectedSet = new Set(
        selected.map(String)
    );

    const matchingCodes = new Set();

    OBJECTIVES.forEach((objective) => {

        if (!selectedSet.has(String(objective.key))) {
            return;
        }

        objective.codes.forEach((code) => {
            matchingCodes.add(code);
        });

    });

    const recommendations = activeTypes
        .filter((type) =>
            matchingCodes.has(type.code)
        )
        .map((type) => {

            const matchedObjectives =
                OBJECTIVES.filter((objective) =>
                    selectedSet.has(String(objective.key)) &&
                    objective.codes.includes(type.code)
                );

            return {
                id: type.id,
                code: type.code,
                name: type.name,
                description: type.description || '',
                explanation:
                    matchedObjectives.length === 1
                        ? matchedObjectives[0].description
                        : 'This Investigation Service matches one or more of the areas you selected.'
            };

        });

    return recommendations;
}


module.exports = {
    getObjectives,
    recommend
};

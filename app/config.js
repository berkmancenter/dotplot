const serverURL = 'http://localhost:3000';
const frontendURL = 'http://localhost:4200';

export const fuzzyConf = {
    id: 'id',
    shouldSort: true,
    threshold: 0.3,
    location: 0,
    distance: 100,
    maxPatternLength: 32,
    minMatchCharLength: 3,
    keys: [
        "Q1",
        "Q2",
        "V1",
        "V2"
    ]
};

export const visualConf = {
    opacity: 0.7,
    transitionIn: 500,
    transition: 200,
    transitionOut: 100,
    notificationDuration: 2000,
    radius: 5,
    charge: 6,
    gravity: 8,
    scale: 1,
    collisionStrength: 0.8,
    missingColor: '#AAA',
    forceFociTransition: 0.45
};

export const serverConf = {
    apiEndpoint: serverURL + '/api/project/',
    renderEndpoint: serverURL + '/api/render',
    previewEndpoint: frontendURL + '/project?id='
};

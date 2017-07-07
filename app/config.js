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

export const serverConf = {
    apiEndpoint: 'http://localhost:3000/api/project/',
    renderEndpoint: 'http://localhost:3000/api/render/',
    previewEndpoint: 'http://localhost:4200/project?id='
}
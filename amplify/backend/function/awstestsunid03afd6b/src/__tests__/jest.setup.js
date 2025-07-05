beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.AWS_REGION = 'eu-west-1';
    process.env.USER_TABLE_NAME = 'dynamo3a4ecaa7-dev';
});

afterAll(() => {
    jest.clearAllMocks();
});

global.testHelpers = {
    createTestUser: (overrides = {}) => ({
        id: 'test-user-' + Math.random().toString(36).substr(2, 9),
        email: `test-${Date.now()}@example.com`,
        name: 'Test User',
        ...overrides
    }),
    
    createTestEvent: (action, data) => ({
        action,
        data,
        requestId: 'test-request-' + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString()
    }),
    
    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

jest.setTimeout(10000);
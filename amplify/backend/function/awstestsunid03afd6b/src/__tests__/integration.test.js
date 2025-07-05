const mockSend = jest.fn();
const mockDynamoDBClient = jest.fn(() => ({}));
const mockDynamoDBDocumentClient = {
    from: jest.fn(() => ({ send: mockSend }))
};

jest.doMock("@aws-sdk/client-dynamodb", () => ({
    DynamoDBClient: mockDynamoDBClient
}));

jest.doMock("@aws-sdk/lib-dynamodb", () => ({
    DynamoDBDocumentClient: mockDynamoDBDocumentClient,
    PutCommand: jest.fn((params) => ({ input: params })),
    GetCommand: jest.fn((params) => ({ input: params }))
}));

const { handler, add_user, get_user } = require('../index');

describe('Integration Tests - User Service Workflows', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSend.mockReset();
        
        process.env.USER_TABLE_NAME = 'User-test';
        process.env.AWS_REGION = 'us-east-1';
    });

    describe('Workflow complet utilisateur', () => {
        test('devrait créer et récupérer un utilisateur avec succès', async () => {
            const testUser = {
                id: 'integration-user-' + Math.random().toString(36).substr(2, 9),
                email: 'integration@example.com',
                name: 'Integration Test User'
            };

            mockSend.mockResolvedValueOnce({});
            
            const savedUser = {
                ...testUser,
                createdAt: '2024-01-01T10:00:00.000Z',
                updatedAt: '2024-01-01T10:00:00.000Z'
            };
            mockSend.mockResolvedValueOnce({ Item: savedUser });

            const createResult = await add_user(testUser);
            
            expect(createResult.success).toBe(true);
            expect(createResult.user.email).toBe(testUser.email);

            const getResult = await get_user(testUser.id);

            expect(getResult.success).toBe(true);
            expect(getResult.user.id).toBe(testUser.id);
            expect(getResult.user.email).toBe(testUser.email);
        });

        test('devrait gérer le workflow via le handler Lambda', async () => {
            const testUser = {
                id: 'handler-test-' + Math.random().toString(36).substr(2, 9),
                email: 'handler@example.com',
                name: 'Handler Test User'
            };
            
            const addEvent = {
                action: 'add_user',
                data: testUser
            };
            
            const getEvent = {
                action: 'get_user',
                data: { userId: testUser.id }
            };

            mockSend.mockResolvedValueOnce({});
            mockSend.mockResolvedValueOnce({ 
                Item: { 
                    ...testUser, 
                    createdAt: '2024-01-01T10:00:00.000Z',
                    updatedAt: '2024-01-01T10:00:00.000Z'
                } 
            });

            const createResponse = await handler(addEvent);
            expect(createResponse.success).toBe(true);

            const getResponse = await handler(getEvent);
            expect(getResponse.success).toBe(true);
            expect(getResponse.user.id).toBe(testUser.id);
        });
    });

    describe('Gestion des erreurs en cascade', () => {
        test('devrait gérer la tentative de création d\'un utilisateur existant puis récupération', async () => {
            const testUser = {
                id: 'existing-user-123',
                email: 'existing@example.com',
                name: 'Existing User'
            };
            
            const conditionalError = new Error('User already exists');
            conditionalError.name = 'ConditionalCheckFailedException';
            mockSend.mockRejectedValueOnce(conditionalError);

            mockSend.mockResolvedValueOnce({ 
                Item: { 
                    ...testUser, 
                    createdAt: '2024-01-01T09:00:00.000Z',
                    updatedAt: '2024-01-01T09:00:00.000Z'
                } 
            });

            const createResult = await add_user(testUser);
            
            expect(createResult.success).toBe(false);
            expect(createResult.code).toBe('USER_EXISTS');

            const getResult = await get_user(testUser.id);
            
            expect(getResult.success).toBe(true);
            expect(getResult.user.id).toBe(testUser.id);
        });
    });

    describe('Tests de simulation de performance', () => {
        test('devrait traiter plusieurs utilisateurs en séquence', async () => {
            const users = Array.from({ length: 3 }, (_, i) => ({
                id: `perf-test-user-${i}`,
                email: `perf-test-${i}@example.com`,
                name: `Performance Test User ${i}`
            }));
            
            users.forEach(() => mockSend.mockResolvedValueOnce({}));

            const startTime = Date.now();

            const results = [];
            for (const user of users) {
                const result = await add_user(user);
                results.push(result);
            }

            const endTime = Date.now();

            expect(results).toHaveLength(3);
            results.forEach(result => {
                expect(result.success).toBe(true);
            });

            expect(mockSend).toHaveBeenCalledTimes(3);
            console.log(`Tests de performance: ${endTime - startTime}ms pour ${users.length} utilisateurs`);
        });
    });
});
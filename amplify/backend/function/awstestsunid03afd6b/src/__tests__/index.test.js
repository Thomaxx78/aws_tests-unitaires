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

describe('UserService Lambda', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSend.mockReset();
        
        process.env.USER_TABLE_NAME = 'User-test';
        process.env.AWS_REGION = 'us-east-1';
    });

    describe('add_user', () => {
        test('devrait créer un utilisateur avec succès', async () => {
            const userData = {
                id: 'user123',
                email: 'test@example.com',
                name: 'Test User'
            };

            mockSend.mockResolvedValueOnce({});

            const result = await add_user(userData);

            expect(result.success).toBe(true);
            expect(result.user.id).toBe(userData.id);
            expect(result.user.email).toBe(userData.email);
            expect(result.user.name).toBe(userData.name);
            expect(result.user.createdAt).toBeDefined();
            expect(result.user.updatedAt).toBeDefined();
            expect(result.message).toBe('Utilisateur créé avec succès');

            expect(mockSend).toHaveBeenCalledTimes(1);
        });

        test('devrait échouer si ID manquant', async () => {
            const userData = {
                email: 'test@example.com'
            };

            const result = await add_user(userData);

            expect(result.success).toBe(false);
            expect(result.error).toBe('ID et email sont requis');
            expect(result.code).toBe('ADD_USER_ERROR');
            expect(mockSend).not.toHaveBeenCalled();
        });

        test('devrait échouer si email manquant', async () => {
            const userData = {
                id: 'user123'
            };

            const result = await add_user(userData);

            expect(result.success).toBe(false);
            expect(result.error).toBe('ID et email sont requis');
            expect(result.code).toBe('ADD_USER_ERROR');
            expect(mockSend).not.toHaveBeenCalled();
        });

        test('devrait gérer le cas où l\'utilisateur existe déjà', async () => {
            const userData = {
                id: 'user123',
                email: 'test@example.com'
            };

            const conditionalError = new Error('The conditional request failed');
            conditionalError.name = 'ConditionalCheckFailedException';
            mockSend.mockRejectedValueOnce(conditionalError);

            const result = await add_user(userData);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Utilisateur avec cet ID existe déjà');
            expect(result.code).toBe('USER_EXISTS');
        });

        test('devrait gérer les erreurs DynamoDB génériques', async () => {
            const userData = {
                id: 'user123',
                email: 'test@example.com'
            };

            mockSend.mockRejectedValueOnce(new Error('DynamoDB error'));

            const result = await add_user(userData);
            expect(result.success).toBe(false);
            expect(result.error).toBe('DynamoDB error');
            expect(result.code).toBe('ADD_USER_ERROR');
        });
    });

    describe('get_user', () => {
        test('devrait récupérer un utilisateur existant', async () => {
            const userId = 'user123';
            const mockUser = {
                id: userId,
                email: 'test@example.com',
                name: 'Test User',
                createdAt: '2024-01-01T00:00:00.000Z'
            };

            mockSend.mockResolvedValueOnce({
                Item: mockUser
            });

            const result = await get_user(userId);

            expect(result.success).toBe(true);
            expect(result.user).toEqual(mockUser);
            expect(mockSend).toHaveBeenCalledTimes(1);
        });

        test('devrait retourner une erreur si utilisateur non trouvé', async () => {
            const userId = 'nonexistent';

            mockSend.mockResolvedValueOnce({
                Item: undefined
            });
            const result = await get_user(userId);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Utilisateur non trouvé');
            expect(result.code).toBe('USER_NOT_FOUND');
        });

        test('devrait échouer si ID utilisateur manquant', async () => {
            const result = await get_user('');

            
            expect(result.success).toBe(false);
            expect(result.error).toBe('ID utilisateur requis');
            expect(result.code).toBe('GET_USER_ERROR');
            expect(mockSend).not.toHaveBeenCalled();
        });

        test('devrait échouer si ID utilisateur est null', async () => {
            
            const result = await get_user(null);

            
            expect(result.success).toBe(false);
            expect(result.error).toBe('ID utilisateur requis');
            expect(result.code).toBe('GET_USER_ERROR');
            expect(mockSend).not.toHaveBeenCalled();
        });

        test('devrait gérer les erreurs DynamoDB', async () => {
            const userId = 'user123';
            mockSend.mockRejectedValueOnce(new Error('DynamoDB connection error'));

            
            const result = await get_user(userId);

            
            expect(result.success).toBe(false);
            expect(result.error).toBe('DynamoDB connection error');
            expect(result.code).toBe('GET_USER_ERROR');
        });
    });

    describe('handler', () => {
        test('devrait router vers add_user', async () => {
            const event = {
                action: 'add_user',
                data: {
                    id: 'user123',
                    email: 'test@example.com',
                    name: 'Test User'
                }
            };

            mockSend.mockResolvedValueOnce({});

            
            const result = await handler(event);

            
            expect(result.success).toBe(true);
            expect(result.user.id).toBe(event.data.id);
            expect(result.user.email).toBe(event.data.email);
            expect(result.user.name).toBe(event.data.name);
        });

        test('devrait router vers get_user', async () => {
            const event = {
                action: 'get_user',
                data: {
                    userId: 'user123'
                }
            };

            const mockUser = {
                id: 'user123',
                email: 'test@example.com',
                name: 'Test User'
            };

            mockSend.mockResolvedValueOnce({
                Item: mockUser
            });

            
            const result = await handler(event);

            
            expect(result.success).toBe(true);
            expect(result.user).toEqual(mockUser);
        });

        test('devrait gérer une action non supportée', async () => {
            const event = {
                action: 'unknown_action',
                data: {}
            };

            
            const result = await handler(event);

            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Action non supportée');
            expect(result.code).toBe('UNSUPPORTED_ACTION');
        });

        test('devrait gérer les erreurs générales', async () => {
            const event = null;

            
            const result = await handler(event);

            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Erreur interne du serveur');
            expect(result.code).toBe('INTERNAL_ERROR');
        });

        test('devrait gérer les événements avec structure invalide', async () => {
            const event = {
                randomProperty: 'test'
            };

            
            const result = await handler(event);

            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Action non supportée');
            expect(result.code).toBe('UNSUPPORTED_ACTION');
        });
    });

    describe('Tests supplémentaires de validation', () => {
        test('add_user devrait ajouter createdAt et updatedAt', async () => {
            const userData = {
                id: 'user123',
                email: 'test@example.com'
            };

            mockSend.mockResolvedValueOnce({});

            
            const result = await add_user(userData);

            
            expect(result.success).toBe(true);
            expect(result.user.createdAt).toBeDefined();
            expect(result.user.updatedAt).toBeDefined();
            expect(new Date(result.user.createdAt)).toBeInstanceOf(Date);
            expect(new Date(result.user.updatedAt)).toBeInstanceOf(Date);
        });

        test('add_user devrait préserver les propriétés supplémentaires', async () => {
            const userData = {
                id: 'user123',
                email: 'test@example.com',
                name: 'Test User',
                age: 30,
                department: 'IT'
            };

            mockSend.mockResolvedValueOnce({});

            
            const result = await add_user(userData);

            
            expect(result.success).toBe(true);
            expect(result.user.age).toBe(30);
            expect(result.user.department).toBe('IT');
        });
    });
});
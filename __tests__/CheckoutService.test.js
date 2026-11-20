import { CheckoutService } from '../src/services/CheckoutService.js';
import { Item } from '../src/domain/Item.js';
import { CarrinhoBuilder } from './builders/CarrinhoBuilder.js';
import { UserMother } from './builders/UserMother.js';

const CARTAO = '4111-1111-1111-1111';

describe('CheckoutService', () => {
    describe('quando o pagamento falha', () => {
        let gatewayStub;
        let repositoryDummy;
        let emailDummy;
        let checkoutService;

        beforeEach(() => {
            // Stub: só devolve uma resposta pré-definida para controlar o fluxo.
            gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: false }) };
            // Dummies: preenchem o construtor, não devem ser usados neste cenário.
            repositoryDummy = { salvar: jest.fn() };
            emailDummy = { enviarEmail: jest.fn() };
            checkoutService = new CheckoutService(gatewayStub, repositoryDummy, emailDummy);
        });

        it('deve retornar null', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder().build();

            // Act
            const pedido = await checkoutService.processarPedido(carrinho, CARTAO);

            // Assert (verificação de estado)
            expect(pedido).toBeNull();
        });

        it('não deve salvar o pedido nem enviar e-mail', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder().build();

            // Act
            await checkoutService.processarPedido(carrinho, CARTAO);

            // Assert
            expect(repositoryDummy.salvar).not.toHaveBeenCalled();
            expect(emailDummy.enviarEmail).not.toHaveBeenCalled();
        });
    });

    describe('quando um cliente padrão finaliza a compra', () => {
        it('deve retornar o pedido salvo com o total sem desconto', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder()
                .comItens([new Item('Teclado', 100), new Item('Mouse', 50)])
                .build();
            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            const repositoryStub = { salvar: jest.fn(async (pedido) => ({ ...pedido, id: 1 })) };
            const emailDummy = { enviarEmail: jest.fn() };
            const checkoutService = new CheckoutService(gatewayStub, repositoryStub, emailDummy);

            // Act
            const pedido = await checkoutService.processarPedido(carrinho, CARTAO);

            // Assert (verificação de estado)
            expect(pedido.id).toBe(1);
            expect(pedido.totalFinal).toBe(150);
            expect(pedido.status).toBe('PROCESSADO');
            expect(pedido.carrinho).toBe(carrinho);
        });
    });

    describe('quando um cliente Premium finaliza a compra', () => {
        let carrinho;
        let gatewayStub;
        let repositoryStub;
        let emailMock;
        let checkoutService;

        beforeEach(() => {
            // Arrange
            carrinho = new CarrinhoBuilder()
                .comUser(UserMother.umUsuarioPremium())
                .comItens([new Item('Monitor', 150), new Item('Webcam', 50)]) // R$ 200,00
                .build();
            // Stubs: controlam o fluxo (pagamento aprovado, pedido salvo com id 42).
            gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            repositoryStub = { salvar: jest.fn(async (pedido) => ({ ...pedido, id: 42 })) };
            // Mock: o que interessa é a interação (se foi chamado e com quais argumentos).
            emailMock = { enviarEmail: jest.fn().mockResolvedValue(undefined) };
            checkoutService = new CheckoutService(gatewayStub, repositoryStub, emailMock);
        });

        it('deve cobrar o valor com 10% de desconto', async () => {
            // Act
            await checkoutService.processarPedido(carrinho, CARTAO);

            // Assert (verificação de comportamento)
            expect(gatewayStub.cobrar).toHaveBeenCalledWith(180, CARTAO);
        });

        it('deve enviar o e-mail de confirmação uma única vez', async () => {
            // Act
            await checkoutService.processarPedido(carrinho, CARTAO);

            // Assert (verificação de comportamento)
            expect(emailMock.enviarEmail).toHaveBeenCalledTimes(1);
            expect(emailMock.enviarEmail).toHaveBeenCalledWith(
                'premium@email.com',
                'Seu Pedido foi Aprovado!',
                'Pedido 42 no valor de R$180'
            );
        });
    });

    describe('quando o envio de e-mail falha', () => {
        let consoleErrorSpy;

        beforeEach(() => {
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            consoleErrorSpy.mockRestore();
        });

        it('deve concluir o checkout mesmo assim', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder().build();
            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            const repositoryStub = { salvar: jest.fn(async (pedido) => ({ ...pedido, id: 7 })) };
            const emailStub = { enviarEmail: jest.fn().mockRejectedValue(new Error('SMTP fora do ar')) };
            const checkoutService = new CheckoutService(gatewayStub, repositoryStub, emailStub);

            // Act
            const pedido = await checkoutService.processarPedido(carrinho, CARTAO);

            // Assert
            expect(pedido.id).toBe(7);
            expect(pedido.status).toBe('PROCESSADO');
            expect(consoleErrorSpy).toHaveBeenCalledWith('Falha ao enviar e-mail', 'SMTP fora do ar');
        });
    });
});

import { CheckoutService } from '../src/services/CheckoutService.js';
import { Item } from '../src/domain/Item.js';
import { CarrinhoBuilder } from './builders/CarrinhoBuilder.js';

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
        it.todo('deve cobrar o valor com 10% de desconto');
        it.todo('deve enviar o e-mail de confirmação uma única vez');
    });

    describe('quando o envio de e-mail falha', () => {
        it.todo('deve concluir o checkout mesmo assim');
    });
});

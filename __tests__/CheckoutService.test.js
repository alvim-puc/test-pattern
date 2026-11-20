import { CheckoutService } from '../src/services/CheckoutService.js';

describe('CheckoutService', () => {
    describe('quando o pagamento falha', () => {
        it.todo('deve retornar null');
        it.todo('não deve salvar o pedido nem enviar e-mail');
    });

    describe('quando um cliente padrão finaliza a compra', () => {
        it.todo('deve retornar o pedido salvo com o total sem desconto');
    });

    describe('quando um cliente Premium finaliza a compra', () => {
        it.todo('deve cobrar o valor com 10% de desconto');
        it.todo('deve enviar o e-mail de confirmação uma única vez');
    });

    describe('quando o envio de e-mail falha', () => {
        it.todo('deve concluir o checkout mesmo assim');
    });
});

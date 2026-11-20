<div class="capa">
<p class="instituicao">Testes de Software</p>
<p class="titulo">Implementando Padrões de Teste<br/>(Test Patterns)</p>
<p class="subtitulo">Object Mother, Data Builder, Stubs e Mocks aplicados ao CheckoutService</p>
<p class="aluno">Bernardo Souza Alvim<br/>Matrícula: 859148</p>
<p class="repo">Repositório: <a href="https://github.com/alvim-puc/test-pattern">github.com/alvim-puc/test-pattern</a></p>
<p class="data">Novembro de 2026</p>
</div>

<pdf:nextpage />

## 1. Visão geral

O código está em [https://github.com/alvim-puc/test-pattern](https://github.com/alvim-puc/test-pattern). A suíte foi construída para o `CheckoutService`, o SUT do projeto, e está em `__tests__/CheckoutService.test.js`. Os padrões de criação de dados ficam em `__tests__/builders/`. São seis testes, todos no formato Arrange–Act–Assert, cobrindo: falha no pagamento, compra de cliente padrão, desconto Premium, envio de e-mail e a resiliência a uma falha no e-mail. Os seis passam com `npm test`, e o `CheckoutService.js` fica com 100% de cobertura de linhas e de *branches*. Como checagem extra, troquei o desconto de 10% por 20% no SUT: os dois testes Premium falharam, o que confirma que eles realmente verificam a regra de negócio.

## 2. Padrões de criação de dados

**Object Mother (`UserMother`).** O usuário tem poucas variações relevantes para o checkout: ele é `PADRAO` ou `PREMIUM`. Para isso bastam dois métodos estáticos com nomes de domínio, `umUsuarioPadrao()` e `umUsuarioPremium()`, que devolvem instâncias fixas e prontas.

**Por que `CarrinhoBuilder` e não `CarrinhoMother`.** O carrinho combina várias dimensões independentes: o usuário (padrão ou Premium), a quantidade de itens, os preços (que definem o total esperado) e o caso vazio. Um Object Mother precisaria de um método para cada combinação (`umCarrinhoPremiumComDoisItensDe200()`, `umCarrinhoPadraoVazio()`, ...), uma explosão de métodos em que o nome não comporta tudo o que o teste precisa saber. O Data Builder começa com um carrinho válido (usuário padrão e um item de R$ 100) e expõe métodos fluentes (`comUser`, `comItens`, `comItem`, `vazio`), de modo que cada teste altera **apenas** o que importa para o seu cenário e depois chama `build()`. Os dois padrões se complementam: o builder usa o `UserMother` como valor padrão, e o teste Premium passa `UserMother.umUsuarioPremium()` para o `comUser`.

**Antes: setup manual (teste Premium).**

```js
const user = new User(2, 'Usuário Premium', 'premium@email.com', 'PREMIUM');
const monitor = new Item('Monitor', 150);
const webcam = new Item('Webcam', 50);
const carrinho = new Carrinho(user, [monitor, webcam]);
```

**Depois: com o Data Builder.**

```js
const carrinho = new CarrinhoBuilder()
    .comUser(UserMother.umUsuarioPremium())
    .comItens([new Item('Monitor', 150), new Item('Webcam', 50)]) // R$ 200,00
    .build();
```

No cenário de falha de pagamento a diferença é ainda maior. Ali qualquer carrinho válido serve, e o setup manual exigiria inventar id, nome, e-mail, tipo e itens que não têm relação com o que está sendo testado. Com o builder, o setup inteiro fica `new CarrinhoBuilder().build()`.

**Legibilidade e manutenção.** Na versão manual, o leitor precisa descobrir quais dos sete argumentos são relevantes. Na versão com builder, o código diz explicitamente "usuário Premium, R$ 200 em itens", ou seja, só os dados que determinam o resultado esperado (R$ 180). Isso elimina o *Obscure Setup*, porque o teste passa a se ler como uma especificação. Na manutenção, se o construtor de `Carrinho` ou de `User` mudar (um novo campo obrigatório, por exemplo), a correção é feita em um único lugar, no builder ou no Mother, e não em todos os testes. Isso evita que mudanças estruturais tornem a suíte frágil.

## 3. Test Doubles: Stubs × Mocks

No teste de sucesso Premium (Etapa 5), as três dependências do `CheckoutService` foram substituídas assim:

| Dependência | Papel | Configuração | O que o teste verifica |
|---|---|---|---|
| GatewayPagamento | **Stub** (com uso de *spy*) | `cobrar` resolve `{ success: true }` | o valor cobrado (R$ 180, com desconto) |
| PedidoRepository | **Stub** | `salvar` devolve o pedido com `id: 42` | nada; só fornece o id usado no e-mail |
| EmailService | **Mock** | `enviarEmail` é um `jest.fn()` | chamado 1 vez, com destinatário, assunto e mensagem corretos |

As asserções correspondentes no código são:

```js
expect(gatewayStub.cobrar).toHaveBeenCalledWith(180, CARTAO);
expect(emailMock.enviarEmail).toHaveBeenCalledTimes(1);
expect(emailMock.enviarEmail).toHaveBeenCalledWith(
    'premium@email.com', 'Seu Pedido foi Aprovado!', 'Pedido 42 no valor de R$180');
```

**Por que o `GatewayPagamento` foi (principalmente) um Stub.** A função dele no teste é **controlar o fluxo**: ao responder `{ success: true }`, ele leva o SUT pelo caminho de sucesso. É uma resposta pré-definida (*canned answer*) e, no teste de falha da Etapa 4, a mesma técnica com `{ success: false }` leva ao caminho que retorna `null`. Ali a asserção é de estado puro (`expect(pedido).toBeNull()`). O "principalmente" vem do fato de que, no cenário Premium, o desconto não aparece no valor de retorno do método. O único lugar onde o valor de R$ 180 fica observável é o argumento passado a `cobrar`. Por isso o teste também consulta o registro de chamadas do stub. Na terminologia de Meszaros isso é um *Test Spy*: o double continua sendo, antes de tudo, um fornecedor de respostas, e a verificação é um uso secundário.

**Por que o `EmailService` foi um Mock.** O envio de e-mail é um **efeito colateral** puro. O `enviarEmail` não devolve nada que o SUT use, e o resultado de `processarPedido` é o mesmo com ou sem o envio. Por isso não existe estado para verificar, e a única forma de saber se o comportamento está correto é verificar a **interação**: se o e-mail foi enviado, quantas vezes, para quem e com qual mensagem. É exatamente a distinção de Fowler em *Mocks Aren't Stubs*. Stubs servem à **verificação de estado** (preparamos as entradas indiretas e olhamos o resultado), e Mocks servem à **verificação de comportamento** (as expectativas recaem sobre as saídas indiretas do SUT).

**Dummies.** No cenário de falha, `PedidoRepository` e `EmailService` foram passados como dublês vazios, só para satisfazer o construtor. Um teste separado confirma que eles **não** foram chamados (`not.toHaveBeenCalled()`). Separar esse teste mantém a asserção de estado (`toBeNull`) e a de comportamento em testes distintos, cada um com um único motivo para falhar.

## 4. Conclusão

Os padrões de teste trocam a correção posterior de *Test Smells* pela prevenção. Os padrões de criação (Object Mother para entidades estáveis, Data Builder para objetos com muitas combinações) atacam o *Obscure Setup* e a duplicação de setup: cada teste mostra só os dados que justificam a asserção, e as mudanças nos construtores ficam concentradas em um ponto. Os Test Doubles atacam o *Fragile Test* e a dependência de recursos externos. Nenhum teste toca o gateway, o banco ou o servidor de e-mail reais, e por isso a suíte é rápida, determinística e reproduzível. Além disso, escolher deliberadamente entre Stub e Mock evita o excesso de especificação: verifica-se a interação só onde ela **é** o comportamento esperado (o e-mail e o valor cobrado), e o restante é avaliado pelo estado. O resultado é uma suíte que documenta as regras de negócio, falha pelos motivos certos e continua barata de manter à medida que o sistema evolui.

**Referências.** Jest, *Mock Functions* (jestjs.io/docs/mock-functions). Fowler, M., *Mocks Aren't Stubs* (martinfowler.com/articles/mocksArentStubs.html). Meszaros, G., *xUnit Test Patterns* (xunitpatterns.com).

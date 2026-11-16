# Design system Beehive

A paleta e as medidas compartilhadas ficam em `css/design-system.css`.

| Elemento | Referência | Uso |
|---|---|---|
| Fundo da página | `--beehive-fundo` | Creme aplicado ao fundo, atrás do conteúdo. |
| Superfície | `--beehive-superficie` | Branco para formulários, painéis e controles. |
| Texto | `--beehive-texto` | Cor escura para leitura e ações principais. |
| Ação principal | `--beehive-mel` | Amarelo dos botões principais. |
| Foco de teclado | `--beehive-foco` | Contorno visível durante a navegação com Tab. |
| Cantos | `--beehive-raio-controle`, `--beehive-raio-painel` | 10 px nos controles e 16 px nos painéis. |
| Área de toque | `--beehive-altura-controle` | Altura mínima de 44 px para o botão Voltar. |

Nas telas internas, use `.btn` para a ação principal e `.beehive-voltar` com `css/navegacao.css` para voltar à tela de origem. Preserve a identidade das seções de apresentação e campanha, usando o creme compartilhado no fundo da página.

# SN2 AR

Visualização tridimensional da reação **Br⁻ + CH₃Cl → CH₃Br + Cl⁻**, com ataque traseiro, estado de transição e inversão de Walden.

No modo de c&acirc;mera, o MediaPipe reconhece uma m&atilde;o em tempo real: abrir a m&atilde;o aumenta o modelo, fechar diminui e mover/inclinar a m&atilde;o orienta a rea&ccedil;&atilde;o. Arraste e pin&ccedil;a continuam dispon&iacute;veis como alternativa.

## Página

Depois de ativar o GitHub Pages para a branch `main`, a aplicação fica disponível em:

<https://arigony.github.io/sn2/>

## Arquivos 3D

- `assets/SN2_PES_animation_HQ.glb`: formato principal para Three.js e web/AR.
- `assets/SN2_PES_animation_HQ.fbx`: alternativa para importação em outros programas 3D.

O GLB usa as geometrias de alta definição e as curvas da animação original do Blender, amostradas a 30 quadros por segundo. A superfície PES original é uma metaball com topologia variável e material procedural; por isso, a página a recompõe em tempo real com Marching Cubes, guiada pelas posições dos átomos do próprio GLB.

## Uso local

Sirva a pasta por HTTP/HTTPS. O acesso à câmera exige HTTPS (ou `localhost`).

## Créditos técnicos

Blender 4.5 LTS, glTF 2.0, Three.js e Marching Cubes.

Refer&ecirc;ncia visual e cient&iacute;fica: [tutorial “Simple SN2 reaction” do EasyHybrid](https://sites.google.com/view/easyhybrid/tutorials/simple_sn2_reaction_new?authuser=0). A superf&iacute;cie PES da p&aacute;gina &eacute; uma representa&ccedil;&atilde;o interativa derivada da anima&ccedil;&atilde;o, n&atilde;o um c&aacute;lculo qu&acirc;ntico executado no navegador.

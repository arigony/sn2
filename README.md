# SN2 AR

Visualização tridimensional da reação **Br⁻ + CH₃Cl → CH₃Br + Cl⁻**, com ataque traseiro, estado de transição e inversão de Walden.

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

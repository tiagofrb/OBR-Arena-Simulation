# Progresso — OBR Judge Trainer

## Concluído anteriormente
- Pincel unificado (cores OBR + RGB, linha 2 cliques, zona sucesso UI)
- Fundo branco construtores; objeto transparente na arena
- Editar ladrilho da biblioteca
- Import limpa arena; reset manual do robô
- Toggle ladrilhos/objetos no editor; paleta de objetos

## Nova funcionalidade — Construtor de robô + script

### Aba 6 — Construtor de robô
- Corpo (largura × comprimento mm)
- Detector **under** (solo): retângulo no chassi
- Detector **forward**: retângulo ou triângulo projetado à frente
- Arrastar no canvas; editar parâmetros; biblioteca salvar/carregar/usar

### Sensores
- Amostragem under/forward → `{ r, g, b, lum }`
- Painel de leituras na aba Simulação

### Script
- Modo Path (original) vs Script
- `setVelocity(v, omega)` / `stop()` — só move o sprite
- Exemplo seguidor de linha
- Path e manual preservados

### Modelo
- `Robot.definition`, `vLinear`, `vAngular`, `sensorReadings`
- Definição padrão com line_left, line_right, front

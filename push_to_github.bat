@echo off
chcp 65001 >nul
echo ========================================================
echo Script de Sincronização com GitHub - CVFacil.NG
echo ========================================================

:: Define o diretório do script como o diretório do projeto
cd /d "%~dp0"
set "REPO_URL=https://github.com/claudiofxbr/CVFacil.NG.git"

echo Navegando para: %CD%

if %errorlevel% neq 0 (
    echo [ERRO] Não foi possível encontrar o diretório especificado.
    echo Verifique se o caminho existe no seu computador.
    pause
    exit /b
)

echo.
echo Verificando repositório Git...
if not exist .git (
    echo Inicializando novo repositório Git...
    git init
    git branch -M main
    git remote add origin %REPO_URL%
) else (
    echo Repositório Git já detectado.
    echo Garantindo que a URL remota está correta...
    git remote set-url origin %REPO_URL%
)

echo.
echo Adicionando arquivos...
git add .

echo.
echo Criando commit...
set /p COMMIT_MSG="Digite a mensagem do commit (Enter para 'Backup Automatico'): "
if "%COMMIT_MSG%"=="" set COMMIT_MSG=Backup Automatico
git commit -m "%COMMIT_MSG%"

echo.
echo Enviando para o GitHub...
git push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Ocorreu um erro ao enviar para o GitHub.
    echo Possíveis causas:
    echo 1. O repositório remoto não existe ou é privado.
    echo 2. Conflitos de arquivos (o remoto tem alterações que você não tem).
    echo 3. Falha de autenticação.
    echo.
    set /p FORCE="Deseja FORÇAR o envio (sobrescrever o remoto)? (S/N): "
    if /i "%FORCE%"=="S" (
        echo Forçando envio...
        git push -u origin main --force
        if %errorlevel% equ 0 (
            echo [SUCESSO] Código enviado com sucesso (Forçado)!
        ) else (
            echo [ERRO CRÍTICO] Falha ao forçar envio. Verifique suas credenciais.
        )
    )
) else (
    echo.
    echo [SUCESSO] Código enviado para o GitHub com sucesso!
)

echo.
pause

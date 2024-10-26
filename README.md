# Microservicio encargado de la gestión de puntos de ventas

<img src="src/path/to/logo.png" alt="Imagen SysSoft Integra" width="200" />

<font size="5" face="Qwitcher Grypen">
Aplicación para el control de puntos de ventas.
</font>

## Iniciar

Esta proyecto esta echo en Node js y Express.

Algunos recursos para iniciar con este proyecto puedes ver en:

- [Node Js](https://nodejs.org/es/) Entorno de desarrollo para aplicación web o movil usando JavaScript.
- [Express Js](https://expressjs.com/) Express.js o simplemente Express es un entorno de trabajo para aplicaciones web para el programario Node.js, de código abierto y con licencia MIT. .
- [Visual Studio](https://code.visualstudio.com/) Editor de código para todos tipos de lenguaje de programación.
- [TypeScript](https://www.typescriptlang.org/) Lenguaje de programación de tipado fuerte.
- [JavaScript](https://developer.mozilla.org/es/docs/Web/JavaScript) Lenguaje de programación interpretado.
- [Git](https://git-scm.com/) Software de control de versiones.
- [Git Hub](https://github.com/) Plataforma de alojamiento de proyecto de todo ámbito.

## Instalación

Siga los pasos para iniciar el desarrollo:

### 1. Clona el proyecto o agrague el ssh al repositorio para contribuir en nuevos cambios [Git Hub - Software Punto de Venta](https://github.com/luissince/syssoft-integra-backend)

#### 1.1. Agregue por ssh para la integración

Generar tu clave ssh para poder contribuir al proyecto.

```bash
ssh-keygen -t rsa -b 4096 -C "tu email"
```

Configuración global del nombre.

```bash
git config --global user.name "John Doe"
```

Configuración global del email.

```bash
git config --global user.email johndoe@example.com
```

Crea una carpeta.

```bash
mkdir syssoft-integra-backend
```

Moverse a la carpeta.

```bash
cd syssoft-integra-backend
```

Comando para inicia git.

```bash
git init
```

Comando que agrega la referencia de la rama.

```bash
git remote add origin git@github.com:luissince/syssoft-integra-backend.git
```

Comando que descarga los archivos al working directory.

```bash
git fetch origin master
```

Comando que une los cambios al staging area.

```bash
git merge origin/master
```

#### 1.2 Clonar al proyecto

Al clonar un proyecto no necesitas crear ninguna carpeta.

```bash
git clone https://github.com/luissince/syssoft-integra-backend.git
```

### 2. Instale typescript si su proyecto lo usa

```bash
npm install -g typescript
```

### 3. Ejecute en la carpeta la clonada **npm install** para descargar las dependencias del proyecto

```bash
npm install
```

### 4. Copiar el arhivo .env.example para configurar las variables de entorno

```bash
cp .env.example .env
```

### 5. Configuración de Variables de Entorno del Back-end

A continuación, se presenta la configuración de las variables de entorno utilizadas en el back-end:

Puerto para la ejecución del servidor

```bash
PORT=5000
```

Ip pública o remota de la base de datos

```bash
DB_HOST=
```

Nombre del usuario de la base de datos

```bash
DB_USER=
```

Contraseña del usuario de la base de datos

```bash
DB_PASSWORD=
```

Nombre de la base de datos

```bash
DB_NAME=
```

Puerto de la base de datos

```bash
DB_PORT=3306
```

Nombre de la cuenta

```bash
CLOUDFLARE_ACCOUNT_ID="replace_me"
```

ApiKey de la cuenta

```bash
CLOUDFLARE_ACCESS_KEY_ID="replace_me"
```

ApiKey secreta de la cuenta

```bash
CLOUDFLARE_SECRET_ACCESS_KEY="replace_me"
```

Nombre del bucket

```bash
CLOUDFLARE_BUCKET_NAME="replace_me"
```

Nombre del bucket

```bash
FIREBASE_BUCKET="replace_me"
```

URL publica

```bash
FIREBASE_URL_PUBLIC="replace_me"
```

Nombre del archivo de configuración

```bash
FIREBASE_FILE_ACCOUNT_NAME="replace_me"
```

Configuración de la zona horaria

```bash
TZ="America/Lima"
```

```bash
ENVIRONMENT="development"
```

### 6. Ejecute **npm run dev** para iniciar el Banck-end en modo desarrollo

```bash
npm run dev
```

### 7. Ejecute **npm run dev** para iniciar el Banck-end en modo producción

```bash
npm run start
```

### 8. Configuración para Ejecutar GitHub Actions para el CI/CD:

Para ejecutar los workflows de GitHub Actions, asegúrate de que tu usuario tenga los privilegios de ejecución necesarios. A continuación, te proporcionamos algunos pasos para empezar:

#### 8.1. Crea un grupo de Docker:

```bash
sudo groupadd docker
```

#### 8.2. Agrega tu Usuario al Grupo de Docker:

```bash
sudo usermod -aG docker $USER
```

#### 8.3. Aplica los Cambios en el Grupo de Docker:

```bash
newgrp docker
```

#### 8.4. Verifica que tu Usuario esté en el Grupo de Docker:

```bash
groups
```

Asegúrate de que "docker" esté en la lista de grupos.

#### 8.5. Configuración y Uso del Runner:

Para iniciar la creación del runner, ve a Settings del proyecto, luego a Actions, Runners, y selecciona "New self-hosted runner".

Si deseas ejecutar en segundo plano, utiliza los siguientes comandos de configuración:

```bash
sudo ./svc.sh status
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh stop
sudo ./svc.sh uninstall
```

Estos comandos te permiten controlar el runner según sea necesario.

### 9. Punto importante la hacer git push

Cuando realices un git push origin master y desees evitar que se ejecute el flujo de trabajo de GitHub Actions, puedes incorporar [skip ci] o [ci skip] en el mensaje del commit. Esta adición indicará a GitHub Actions que omita la ejecución de los trabajos para ese commit específico.

Por ejemplo, al realizar un commit, puedes utilizar el siguiente comando para incluir [skip ci] en el mensaje del commit:

```bash
git commit -m "Tu mensaje del commit [skip ci]"
```

### 10. Punto importante al hacer al hacer commit

Si deseas mantener mensajes de commit distintos para desarrollo, prueba y producción, pero sin tener que hacer un commit en la rama de desarrollo antes de probar en la rama de prueba, puedes utilizar la opción --no-ff (no fast-forward) al realizar la fusión en cada rama. Esto te permitirá realizar un commit específico en la rama de prueba (y posteriormente en la rama de producción) incluso si no hubo cambios adicionales en desarrollo.

1. En la rama desarrollo

```bash
git checkout desarrollo
git pull origin desarrollo
# Realiza tus cambios y realiza el commit
git add .
git commit -m "Mensaje de desarrollo"
```

2. Cambia a la rama de prueba

```bash
git checkout test
git pull origin test
# Fusiona los cambios de desarrollo con un commit específico
git merge --no-ff desarrollo -m "Mensaje de prueba"
```

El uso de --no-ff asegurará que se cree un nuevo commit, incluso si no hubo cambios adicionales en desarrollo.
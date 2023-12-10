# SOFTWARE DE PUNTO DE VENTA

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

Configuración de la zona horaria

```bash
TZ="America/Lima"
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

Verifica la Existencia del Grupo de Docker:

```bash
sudo groupadd docker
```

Agrega tu Usuario al Grupo de Docker:

```bash
sudo usermod -aG docker $USER
```

Aplica los Cambios en el Grupo de Docker:

```bash
newgrp docker
```

Verifica que tu Usuario esté en el Grupo de Docker:

```bash
newgrp docker
```

Asegúrate de que "docker" esté en la lista de grupos.

Configuración y Uso del Runner:

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

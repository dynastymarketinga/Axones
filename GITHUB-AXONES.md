# Subir **Axones** a GitHub (empresa) y colaborar desde tu usuario

Cuenta destino: **[@ovavisionve](https://github.com/ovavisionve)**. Nombre del repositorio en GitHub: **Axones** (privado).

> **Dónde intervienes tú (no se puede en línea de comandos):** la visibilidad **Private** y las **invitaciones** se hacen en la web de GitHub con tu sesión, no con `git push`.

---

## 1. Crear el repositorio **privado** (cuenta empresa)

1. Inicia sesión en GitHub con la cuenta **ovavisionve**.
2. [Nuevo repositorio](https://github.com/new): nombre **`Axones`**.
3. **Marca "Private"** (no "Public") antes de crear.
4. **No** marques añadir README, .gitignore ni licencia en GitHub si ya tienes el proyecto local; evitas conflictos en el primer push.
5. Crea el repositorio.

**Si ya existe** otro repo (por ejemplo `Proyecto_Axones`) y quieres el nombre `Axones` libre: en ese otro repositorio → **Settings** → **General** (abajo) **Rename** o elimínalo, según te convenga.

---

## 2. Primer push desde esta carpeta (con credenciales de la empresa)

En PowerShell, desde `C:\Users\pc\Desktop\Axones V2` (o donde clonéis):

```powershell
cd "C:\Users\pc\Desktop\Axones V2"
git status
git remote add origin https://github.com/ovavisionve/Axones.git
git branch -M main
git push -u origin main
```

Git te pedirá autenticación: **PAT (token)** o **GitHub CLI** con la sesión de **ovavisionve**. Eso es intencionado: el `origin` apunta a la organización/empresa.

---

## 3. Invitarte a colaborar (cuenta personal)

1. Con **ovavisionve** → repositorio **Axones** → **Settings** → **Collaborators and teams** (o **Access** → **Collaborators**).
2. **Add people** → escribe el **usuario de GitHub de tu cuenta personal** → rol **Write** (o el que necesites).
3. Acepta el correo o la notificación con **esa cuenta personal**.

Así podrás clonar, hacer push y pull **como colaborador** sin usar el remote “empresa” en tu portátil personal si quieres separar flujos.

---

## 4. Quitar `origin` en esta máquina y usar **tu** cuenta (flujo que pediste)

Cuando ya no quieras que `git` en **este** proyecto apunte a la URL de la empresa, o vayas a trabajar con un clon bajo **tu** usuario:

```powershell
cd "C:\Users\pc\Desktop\Axones V2"
git remote -v
git remote remove origin
```

- **Tu identidad** en los commits (opcional, para que aparezca tu nombre en los nuevos commits):

  ```powershell
  git config user.name "Tu Nombre"
  git config user.email "tu-email@..." 
  ```

  (Esto puede ser local al repo o global, según prefieras.)

- Para seguir empujando al repo **de la empresa** sin guardar su URL fija, puedes **añadir otra URL solo cuando toque** o clonar otra copia bajo `https://github.com/ovavisionve/Axones.git` y usar allí el PAT de colaborador.

---

## 5. Resumen rápido

| Qué | Dónde |
|-----|--------|
| Repo **privado** | GitHub al crear el repo, opción **Private** |
| Nombre **Axones** | Al crear; si choca, renombrar o borrar el otro repo |
| Subir código | `git push` con `origin` = `ovavisionve/Axones` y auth de esa cuenta (o tuya si ya eres colaborador) |
| Dejar de usar este `remote` aquí | `git remote remove origin` |
| Colaborar tú solo | **Settings** → **Collaborators** con tu usuario personal → aceptar invitación |

---

## 6. Contenido versionado (recordatorio)

- Incluido: **`backend/`**, **`pulse-ui-react/`**, `README.md`, `.gitignore` en la raíz.
- Excluido por diseño: **`public/`** en la raíz, PDFs y archivos de contexto listados en `.gitignore`.

Cada subcarpeta sigue con su propio `.gitignore` (por ejemplo `node_modules`, `vendor`, `.env`).

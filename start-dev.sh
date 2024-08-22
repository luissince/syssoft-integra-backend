#!/bin/bash

# Verifica la rama actual
current_branch=$(git branch --show-current)

# Si no estás en la rama 'development', cámbiate
if [ "$current_branch" != "development" ]; then
    echo "Advertencia: No estás en la rama 'development'. Estás en '$current_branch'."
    echo "Cambiando a la rama 'development'..."
    git checkout development
fi

npx nodemon index.js
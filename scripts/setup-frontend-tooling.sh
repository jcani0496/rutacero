#!/bin/bash
# Installs dependencies for Testing and Storybook

echo "Installing Testing Library and Jest..."
npm install --save-dev jest @types/jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/dom ts-node

echo "Please run 'npx storybook@latest init' to set up Storybook."

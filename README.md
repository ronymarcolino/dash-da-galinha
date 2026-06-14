# Chicken 3D Game

**Galinha World Tour** - A 3D endless runner game built with Three.js.

## Project Structure

```
├── .dockerignore           # Docker ignore rules
├── docker-compose.yml      # Docker Compose configuration
├── Dockerfile              # Docker image definition
├── index.html              # HTML entry point
├── package.json            # Node.js dependencies and scripts
├── README.md               # Project documentation
├── run.cmd                 # Legacy dev server (keep for reference)
├── src/
│   └── main.js             # Game logic (ES modules)
├── public/
│   └── assets/
│       ├── chicken.glb     # Chicken 3D model
│       └── low-poly-car.glb # Car obstacle 3D model
└── styles.css              # Global styles
```

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (for local dev)
- [Docker](https://docs.docker.com/get-docker/) (for containerized deployment)

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Docker

### Build and run with Docker

```bash
# Build image
docker build -t chicken-3d-game .

# Run container
docker run -p 8080:80 chicken-3d-game
```

### Using Docker Compose

```bash
# Build and start
docker-compose up --build

# Stop
docker-compose down
```

The game will be available at `http://localhost:8080`.

## Controls

- **Arrow Left** - Move left
- **Arrow Right** - Move right

## Gameplay

- Collect yellow eggs to increase your score
- Avoid cars - hitting one ends the game
- Difficulty increases every 5 eggs collected

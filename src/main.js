import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

class Game {
  constructor() {
    this.CONFIG = {
      initialSpeed: 0.2,
      speedIncrement: 0.05,
      spawnRate: 2000,
      minSpawnRate: 500,
      obstacleSpawnMultiplier: 1.5,
    };

    this.score = 0;
    this.gameSpeed = this.CONFIG.initialSpeed;
    this.spawnRate = this.CONFIG.spawnRate;
    this.gameStarted = false;
    this.gameOver = false;
    this.spawnIntervals = [];
    this.eggs = [];
    this.obstacles = [];
    this.clock = new THREE.Clock();

    this.scoreDiv = document.getElementById('score');
    this.startScreen = document.getElementById('start-screen');
    this.gameOverScreen = document.getElementById('game-over-screen');

    this.initThree();
    this.initLights();
    this.initGround();
    this.loadModels();
    this.bindEvents();
    this.handleResize();
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);
    this.camera.position.set(0, 5, 5);
    this.camera.lookAt(0, 0, 0);
  }

  initLights() {
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 10, 7.5);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    const ambLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambLight);
  }

  initGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({
        color: 0x228b22,
        roughness: 0.8,
        metalness: 0.2,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  loadModels() {
    const loader = new GLTFLoader();
    const onError = (err) => console.error('GLTF load error:', err);

    loader.load(
      '/assets/chicken.glb',
      (gltf) => {
        this.chicken = gltf.scene;
        this.chicken.scale.set(1, 1, 1);
        this.chicken.position.set(0, 0.5, 2);
        this.chicken.rotation.y = Math.PI / 2;
        this.chicken.traverse((node) => {
          if (node.isMesh) node.castShadow = true;
        });
        this.scene.add(this.chicken);
        this.checkAllModelsLoaded();
      },
      undefined,
      onError
    );

    loader.load(
      '/assets/low-poly-car.glb',
      (gltf) => {
        this.carPrototype = gltf.scene;
        this.carPrototype.scale.set(2, 2, 2);
        this.carPrototype.traverse((node) => {
          if (node.isMesh) node.castShadow = true;
        });
        this.checkAllModelsLoaded();
      },
      undefined,
      onError
    );
  }

  checkAllModelsLoaded() {
    if (this.chicken && this.carPrototype) {
      const loaderEl = document.getElementById('loader');
      if (loaderEl) loaderEl.style.display = 'none';
    }
  }

  spawnEgg() {
    const geometry = new THREE.SphereGeometry(0.2, 16, 16);
    geometry.scale(1, 1.5, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffff00,
      roughness: 0.1,
      metalness: 0.5,
    });
    const egg = new THREE.Mesh(geometry, material);
    egg.position.set(Math.random() * 6 - 3, 0.3, -20);
    egg.castShadow = true;
    this.scene.add(egg);
    this.eggs.push(egg);
  }

  spawnObstacle() {
    if (!this.carPrototype) return;
    const obs = this.carPrototype.clone();
    obs.position.set(Math.random() * 6 - 3, 0.2, -20);
    this.scene.add(obs);
    this.obstacles.push(obs);
  }

  bindEvents() {
    document.addEventListener('keydown', (e) => {
      if (!this.chicken) return;
      if (e.key === 'ArrowLeft') this.chicken.position.x -= 1;
      if (e.key === 'ArrowRight') this.chicken.position.x += 1;
    });

    this.startScreen.addEventListener('click', () => this.startGame());
    this.gameOverScreen.addEventListener('click', () => location.reload());

    window.addEventListener('resize', () => this.handleResize());
  }

  handleResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  startGame() {
    this.gameStarted = true;
    this.startScreen.style.display = 'none';
    this.score = 0;
    this.updateScoreUI();
    this.gameSpeed = this.CONFIG.initialSpeed;
    this.spawnRate = this.CONFIG.spawnRate;
    this.updateSpawners();
    this.animate();
  }

  endGame() {
    this.gameOver = true;
    this.gameOverScreen.style.display = 'block';
    this.clearSpawners();
  }

  updateScoreUI() {
    this.scoreDiv.innerText = `Ovos: ${this.score}`;
    const high = Number(localStorage.getItem('highScore') || 0);
    if (this.score > high) localStorage.setItem('highScore', this.score);
  }

  updateSpawners() {
    this.clearSpawners();
    this.spawnIntervals.push(setInterval(() => this.spawnEgg(), this.spawnRate));
    this.spawnIntervals.push(
      setInterval(
        () => this.spawnObstacle(),
        this.spawnRate * this.CONFIG.obstacleSpawnMultiplier
      )
    );
  }

  clearSpawners() {
    this.spawnIntervals.forEach(clearInterval);
    this.spawnIntervals = [];
  }

  animate = () => {
    if (this.gameOver) return;
    requestAnimationFrame(this.animate);
    if (!this.gameStarted) return;

    const delta = this.clock.getDelta();
    const move = this.gameSpeed * delta * 60;

    this.eggs.forEach((egg, i) => {
      egg.position.z += move;
      if (this.chicken && egg.position.distanceTo(this.chicken.position) < 1) {
        this.createParticles(egg.position);
        this.scene.remove(egg);
        this.eggs.splice(i, 1);
        this.score++;
        this.updateScoreUI();
        if (this.score % 5 === 0) {
          this.gameSpeed += this.CONFIG.speedIncrement;
          this.spawnRate = Math.max(
            this.CONFIG.minSpawnRate,
            this.spawnRate - 200
          );
          this.updateSpawners();
        }
      }
    });

    this.obstacles.forEach((obs, i) => {
      obs.position.z += move;
      if (this.chicken && obs.position.distanceTo(this.chicken.position) < 1) {
        this.endGame();
      }
    });

    this.renderer.render(this.scene, this.camera);
  };

  createParticles(position) {
    const particleGeom = new THREE.SphereGeometry(0.05, 8, 8);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    for (let i = 0; i < 20; i++) {
      const p = new THREE.Mesh(particleGeom, particleMat);
      p.position.copy(position);
      p.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      );
      this.scene.add(p);
      setTimeout(() => this.scene.remove(p), 500);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const loader = document.createElement('div');
  loader.id = 'loader';
  loader.textContent = 'Loading...';
  document.body.appendChild(loader);

  new Game();
});

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const SKY_COLOR = 0x87ceeb;

class Game {
  constructor() {
    this.CONFIG = {
      initialSpeed: 0.2,
      speedIncrement: 0.05,
      maxSpeed: 0.6,
      spawnRate: 2000,
      minSpawnRate: 500,
      obstacleSpawnMultiplier: 1.5,
      moveDistance: 1,
    };

    this.score = 0;
    this.gameSpeed = this.CONFIG.initialSpeed;
    this.spawnRate = this.CONFIG.spawnRate;
    this.gameStarted = false;
    this.gameOver = false;
    this.spawnIntervals = [];
    this.eggs = [];
    this.obstacles = [];
    this.trees = [];
    this.flowers = [];
    this.clouds = [];
    this.roadDashes = [];
    this.targetX = 0;
    this.clock = new THREE.Clock();
    this.eggCollisionRadius = 1;
    this.obstacleCollisionRadius = 1;

    // Shared geometry/material reused by every egg instance (avoids per-spawn GPU allocations)
    this.eggGeometry = new THREE.CapsuleGeometry(0.2, 0.2, 4, 8);
    this.eggMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      emissive: 0xffa000,
      emissiveIntensity: 0.35,
      roughness: 0.25,
      metalness: 0.4,
    });

    // Shared geometry reused by every particle burst (only the material is cloned, once per burst)
    this.particleGeometry = new THREE.SphereGeometry(0.08, 8, 8);
    this.particleMaterial = new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true });

    this.scoreDiv = document.getElementById('score');
    this.startScreen = document.getElementById('start-screen');
    this.gameOverScreen = document.getElementById('game-over-screen');

    this.audioContext = null;
    this.initAudio();

    this.initThree();
    this.initLights();
    this.initGround();
    this.initScenery();
    this.loadModels();
    this.bindEvents();
    this.handleResize();
    this.animate();
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY_COLOR);
    this.scene.fog = new THREE.Fog(SKY_COLOR, 25, 110);
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);
    this.camera.position.set(0, 5.5, 8);
    this.camera.lookAt(0, 0.5, -5);
  }

  initLights() {
    const dirLight = new THREE.DirectionalLight(0xfff1d6, 1.3);
    dirLight.position.set(8, 14, 6);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.left = -30;
    dirLight.shadow.camera.right = 30;
    dirLight.shadow.camera.top = 30;
    dirLight.shadow.camera.bottom = -30;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 60;
    dirLight.shadow.bias = -0.0004;
    this.scene.add(dirLight);

    const hemiLight = new THREE.HemisphereLight(0xbfe3ff, 0x5da24f, 0.7);
    this.scene.add(hemiLight);

    const ambLight = new THREE.AmbientLight(0xffffff, 0.25);
    this.scene.add(ambLight);
  }

  initAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContext();
  }

  playCollectSound() {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1200, this.audioContext.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.1);
  }

  playGameOverSound() {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.5);

    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.5);
  }

  playStartSound() {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.2);

    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.2);
  }

  initGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 140),
      new THREE.MeshStandardMaterial({
        color: 0x58a44e,
        roughness: 1,
        metalness: 0,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -40;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 140),
      new THREE.MeshStandardMaterial({
        color: 0x3d3d44,
        roughness: 1,
        metalness: 0,
      })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.z = -40;
    road.position.y = 0.005;
    road.receiveShadow = true;
    this.scene.add(road);

    // Yellow edge lines on both sides of the road
    const edgeGeom = new THREE.PlaneGeometry(0.18, 140);
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xf3c14b });
    [-3.85, 3.85].forEach((x) => {
      const edge = new THREE.Mesh(edgeGeom, edgeMat);
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(x, 0.01, -40);
      this.scene.add(edge);
    });

    // Scrolling dashed center line sells the sense of speed
    const dashGeom = new THREE.PlaneGeometry(0.22, 2.4);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 13; i++) {
      const dash = new THREE.Mesh(dashGeom, dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.02, 8 - i * 7.5);
      this.scene.add(dash);
      this.roadDashes.push(dash);
    }

    this.roadLeft = -3.5;
    this.roadRight = 3.5;
  }

  initScenery() {
    // Shared geometries/materials for all decorative props
    this.trunkGeometry = new THREE.CylinderGeometry(0.15, 0.25, 1, 6);
    this.trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 });
    this.leafLowerGeometry = new THREE.ConeGeometry(1, 1.6, 7);
    this.leafUpperGeometry = new THREE.ConeGeometry(0.7, 1.2, 7);
    this.leafMaterials = [0x2e8b57, 0x228b22, 0x3cb043, 0x1e7a3c].map(
      (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
    );

    this.stemGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.35, 5);
    this.stemMaterial = new THREE.MeshStandardMaterial({ color: 0x3f7d2e, roughness: 0.9 });
    this.flowerHeadGeometry = new THREE.SphereGeometry(0.12, 8, 8);
    this.flowerMaterials = [0xff6b81, 0xffd166, 0xffffff, 0xff9f43, 0xc56cf0].map(
      (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
    );

    this.cloudGeometry = new THREE.SphereGeometry(1, 12, 12);
    this.cloudMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1,
      emissive: 0xffffff,
      emissiveIntensity: 0.25,
    });

    this.initTrees();
    this.initFlowers();
    this.initClouds();
    this.initMountains();
  }

  createTree(x, z) {
    const treeGroup = new THREE.Group();

    const trunk = new THREE.Mesh(this.trunkGeometry, this.trunkMaterial);
    trunk.position.y = 0.5;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    const leafMat = this.leafMaterials[Math.floor(Math.random() * this.leafMaterials.length)];
    const lower = new THREE.Mesh(this.leafLowerGeometry, leafMat);
    lower.position.y = 1.7;
    lower.castShadow = true;
    treeGroup.add(lower);

    const upper = new THREE.Mesh(this.leafUpperGeometry, leafMat);
    upper.position.y = 2.6;
    upper.castShadow = true;
    treeGroup.add(upper);

    treeGroup.scale.setScalar(0.7 + Math.random() * 0.8);
    treeGroup.position.set(x, 0, z);
    return treeGroup;
  }

  initTrees() {
    for (let i = 0; i < 20; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      const x = side * (5 + Math.random() * 40);
      const z = -Math.random() * 90;
      const tree = this.createTree(x, z);
      this.scene.add(tree);
      this.trees.push(tree);
    }
  }

  createFlower(x, z) {
    const flower = new THREE.Group();

    const stem = new THREE.Mesh(this.stemGeometry, this.stemMaterial);
    stem.position.y = 0.175;
    flower.add(stem);

    const headMat = this.flowerMaterials[Math.floor(Math.random() * this.flowerMaterials.length)];
    const head = new THREE.Mesh(this.flowerHeadGeometry, headMat);
    head.position.y = 0.38;
    flower.add(head);

    flower.position.set(x, 0, z);
    return flower;
  }

  initFlowers() {
    for (let i = 0; i < 26; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      const x = side * (4.5 + Math.random() * 30);
      const z = -Math.random() * 90;
      const flower = this.createFlower(x, z);
      this.scene.add(flower);
      this.flowers.push(flower);
    }
  }

  createCloud() {
    const cloud = new THREE.Group();
    const puffs = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < puffs; i++) {
      const puff = new THREE.Mesh(this.cloudGeometry, this.cloudMaterial);
      puff.position.set(
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 1.6
      );
      puff.scale.setScalar(0.6 + Math.random() * 0.9);
      cloud.add(puff);
    }
    return cloud;
  }

  initClouds() {
    for (let i = 0; i < 8; i++) {
      const cloud = this.createCloud();
      cloud.position.set(
        (Math.random() - 0.5) * 90,
        8 + Math.random() * 5,
        10 - Math.random() * 100
      );
      cloud.userData.drift = 0.3 + Math.random() * 0.5;
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  initMountains() {
    const colors = [0x86a17d, 0x9fb4a6, 0x7d938a];
    for (let i = 0; i < 7; i++) {
      const height = 8 + Math.random() * 10;
      const radius = 5 + Math.random() * 6;
      const geom = new THREE.ConeGeometry(radius, height, 5 + Math.floor(Math.random() * 3));
      const mat = new THREE.MeshStandardMaterial({
        color: colors[i % colors.length],
        roughness: 1,
        flatShading: true,
      });
      const mountain = new THREE.Mesh(geom, mat);
      const side = i % 2 === 0 ? 1 : -1;
      mountain.position.set(
        side * (18 + Math.random() * 40),
        height / 2 - 0.1,
        -70 - Math.random() * 20
      );
      mountain.rotation.y = Math.random() * Math.PI;
      this.scene.add(mountain);
    }
  }

  loadModels() {
    const loaderEl = document.getElementById('loader');
    const manager = new THREE.LoadingManager();

    manager.onProgress = (url, loaded, total) => {
      if (loaderEl && total) {
        loaderEl.textContent = `Carregando... ${Math.round((loaded / total) * 100)}%`;
      }
    };
    manager.onLoad = () => {
      if (loaderEl) loaderEl.style.display = 'none';
    };
    manager.onError = (url) => {
      console.error('Falha ao carregar asset:', url);
      if (loaderEl) loaderEl.textContent = 'Erro ao carregar o jogo. Recarregue a página.';
    };

    const loader = new GLTFLoader(manager);

    loader.load(`${import.meta.env.BASE_URL}assets/chicken.glb`, (gltf) => {
      this.chicken = gltf.scene;
      this.chicken.scale.set(1, 1, 1);
      this.chicken.position.set(0, 0.5, 2);
      this.chicken.rotation.y = Math.PI / 2;
      this.chicken.traverse((node) => {
        if (node.isMesh) node.castShadow = true;
      });
      this.scene.add(this.chicken);
    });

    loader.load(`${import.meta.env.BASE_URL}assets/low-poly-car.glb`, (gltf) => {
      this.carPrototype = gltf.scene;
      this.carPrototype.scale.set(2, 2, 2);
      this.carPrototype.traverse((node) => {
        if (node.isMesh) node.castShadow = true;
      });
      const bounds = new THREE.Box3().setFromObject(this.carPrototype);
      const size = bounds.getSize(new THREE.Vector3());
      this.obstacleCollisionRadius = Math.max(size.x, size.z) / 2;
    });
  }

  spawnEgg() {
    const egg = new THREE.Mesh(this.eggGeometry, this.eggMaterial);
    egg.position.set(Math.random() * (this.roadRight - this.roadLeft) + this.roadLeft, 0.35, -20);
    egg.rotation.z = 0.35;
    egg.userData.phase = Math.random() * Math.PI * 2;
    egg.castShadow = true;
    this.scene.add(egg);
    this.eggs.push(egg);
  }

  spawnObstacle() {
    if (!this.carPrototype) return;
    const obs = this.carPrototype.clone();
    obs.position.set(Math.random() * (this.roadRight - this.roadLeft) + this.roadLeft, 0.2, -20);
    this.scene.add(obs);
    this.obstacles.push(obs);
  }

  moveLeft() {
    if (!this.chicken) return;
    this.targetX = Math.max(this.roadLeft, this.targetX - this.CONFIG.moveDistance);
  }

  moveRight() {
    if (!this.chicken) return;
    this.targetX = Math.min(this.roadRight, this.targetX + this.CONFIG.moveDistance);
  }

  bindEvents() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.moveLeft();
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.moveRight();
    });

    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    btnLeft.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.moveLeft();
    });
    btnRight.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.moveRight();
    });
    btnLeft.addEventListener('click', () => this.moveLeft());
    btnRight.addEventListener('click', () => this.moveRight());

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
    this.playStartSound();
  }

  endGame() {
    this.gameOver = true;
    const high = Number(localStorage.getItem('highScore') || 0);
    const finalScoreEl = document.getElementById('final-score');
    const eggWord = this.score === 1 ? 'ovo' : 'ovos';
    finalScoreEl.textContent =
      this.score >= high && this.score > 0
        ? `Novo recorde: ${this.score} ${eggWord}!`
        : `Você fez ${this.score} ${eggWord} (recorde: ${high})`;
    this.gameOverScreen.style.display = 'block';
    this.clearSpawners();
    this.playGameOverSound();
  }

  updateScoreUI() {
    const high = Math.max(this.score, Number(localStorage.getItem('highScore') || 0));
    if (this.score > Number(localStorage.getItem('highScore') || 0)) {
      localStorage.setItem('highScore', this.score);
    }
    this.scoreDiv.innerText = `🥚 ${this.score}  |  🏆 ${high}`;
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
    requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();
    const elapsed = this.clock.elapsedTime;
    const playing = this.gameStarted && !this.gameOver;
    const move = playing ? this.gameSpeed * delta * 60 : 0;

    // Clouds drift on their own so the world feels alive even on the start screen
    this.clouds.forEach((cloud) => {
      cloud.position.z += move * 0.25 + cloud.userData.drift * delta;
      if (cloud.position.z > 25) cloud.position.z = -100;
    });

    if (this.chicken) {
      // Lane change eases toward targetX; collisions still use the real position
      const step = Math.min(1, delta * 14);
      this.chicken.position.x += (this.targetX - this.chicken.position.x) * step;
      this.chicken.rotation.y = Math.PI / 2 + (this.targetX - this.chicken.position.x) * 0.4;

      const bobSpeed = playing ? 9 : 3;
      const bobHeight = playing ? 0.1 : 0.04;
      this.chicken.position.y = 0.5 + Math.abs(Math.sin(elapsed * bobSpeed)) * bobHeight;
    }

    if (playing) {
      this.trees.forEach((tree) => {
        tree.position.z += move;
        if (tree.position.z > 10) {
          const side = Math.random() > 0.5 ? 1 : -1;
          tree.position.x = side * (5 + Math.random() * 40);
          tree.position.z = -100;
        }
      });

      this.flowers.forEach((flower) => {
        flower.position.z += move;
        if (flower.position.z > 10) {
          const side = Math.random() > 0.5 ? 1 : -1;
          flower.position.x = side * (4.5 + Math.random() * 30);
          flower.position.z = -100;
        }
      });

      this.roadDashes.forEach((dash) => {
        dash.position.z += move;
        if (dash.position.z > 12) dash.position.z -= this.roadDashes.length * 7.5;
      });

      for (let i = this.eggs.length - 1; i >= 0; i--) {
        const egg = this.eggs[i];
        egg.position.z += move;
        egg.rotation.y += delta * 3;
        egg.position.y = 0.35 + Math.sin(elapsed * 4 + egg.userData.phase) * 0.1;
        if (egg.position.z > 12) {
          this.scene.remove(egg);
          this.eggs.splice(i, 1);
          continue;
        }
        if (this.chicken && egg.position.distanceTo(this.chicken.position) < this.eggCollisionRadius) {
          this.createParticles(egg.position);
          this.scene.remove(egg);
          this.eggs.splice(i, 1);
          this.score++;
          this.playCollectSound();
          this.updateScoreUI();
          if (this.score % 5 === 0) {
            this.gameSpeed = Math.min(
              this.CONFIG.maxSpeed,
              this.gameSpeed + this.CONFIG.speedIncrement
            );
            this.spawnRate = Math.max(
              this.CONFIG.minSpawnRate,
              this.spawnRate - 200
            );
            this.updateSpawners();
          }
        }
      }

      for (let i = this.obstacles.length - 1; i >= 0; i--) {
        const obs = this.obstacles[i];
        obs.position.z += move;
        if (obs.position.z > 12) {
          this.scene.remove(obs);
          this.obstacles.splice(i, 1);
          continue;
        }
        if (this.chicken && obs.position.distanceTo(this.chicken.position) < this.obstacleCollisionRadius) {
          this.endGame();
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

  createParticles(position) {
    // One material per burst (not per particle) - all 30 particles in a burst fade in lockstep,
    // so they can safely share it without visually interfering with other concurrent bursts.
    const burstMaterial = this.particleMaterial.clone();
    const particles = [];

    for (let i = 0; i < 30; i++) {
      const p = new THREE.Mesh(this.particleGeometry, burstMaterial);
      p.position.copy(position);
      p.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        (Math.random() * 0.5) + 0.3,
        (Math.random() - 0.5) * 0.5
      );
      this.scene.add(p);
      particles.push(p);
    }

    let life = 1.0;
    const animateParticles = () => {
      life -= 0.02;
      burstMaterial.opacity = Math.max(0, life);
      particles.forEach(p => {
        p.position.add(p.velocity);
        p.velocity.y -= 0.015;
        p.scale.multiplyScalar(0.95);
      });

      if (life > 0) {
        requestAnimationFrame(animateParticles);
      } else {
        particles.forEach(p => this.scene.remove(p));
        burstMaterial.dispose();
      }
    };

    animateParticles();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const loader = document.createElement('div');
  loader.id = 'loader';
  loader.textContent = 'Carregando... 0%';
  document.body.appendChild(loader);

  new Game();
});

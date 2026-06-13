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

  createTree(x, z) {
    const treeGroup = new THREE.Group();

    const trunkGeom = new THREE.CylinderGeometry(0.2, 0.3, 1, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 });
    const trunk = new THREE.Mesh(trunkGeom, trunkMat);
    trunk.position.y = 0.5;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    const leavesGeom = new THREE.ConeGeometry(1, 2, 8);
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.8 });
    const leaves = new THREE.Mesh(leavesGeom, leavesMat);
    leaves.position.y = 2;
    leaves.castShadow = true;
    treeGroup.add(leaves);

    treeGroup.position.set(x, 0, z);
    return treeGroup;
  }

  initTrees() {
    const treePositions = [];
    for (let i = 0; i < 20; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      const x = side * (5 + Math.random() * 40);
      const z = -Math.random() * 80;
      treePositions.push({ x, z });
    }

    treePositions.forEach(pos => {
      const tree = this.createTree(pos.x, pos.z);
      this.scene.add(tree);
      this.trees.push(tree);
    });
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

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 100),
      new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.9,
        metalness: 0.1,
      })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.z = -40;
    road.receiveShadow = true;
    this.scene.add(road);

    const lineGeom = new THREE.PlaneGeometry(0.2, 100);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const centerLine = new THREE.Mesh(lineGeom, lineMat);
    centerLine.rotation.x = -Math.PI / 2;
    centerLine.position.z = -40;
    centerLine.position.y = 0.01;
    this.scene.add(centerLine);

    this.roadLeft = -3.5;
    this.roadRight = 3.5;

    this.trees = [];
    this.initTrees();
  }

  loadModels() {
    const loader = new GLTFLoader();
    const onError = (err) => console.error('GLTF load error:', err);

    loader.load(
      '/chicken.glb',
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
      '/low-poly-car.glb',
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
    const geometry = new THREE.CapsuleGeometry(0.2, 0.2, 4, 8);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffff00,
      roughness: 0.1,
      metalness: 0.5,
    });
    const egg = new THREE.Mesh(geometry, material);
    egg.position.set(Math.random() * (this.roadRight - this.roadLeft) + this.roadLeft, 0.3, -20);
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

  bindEvents() {
    document.addEventListener('keydown', (e) => {
      if (!this.chicken) return;
      const moveDistance = 1;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        const newX = Math.max(this.roadLeft, this.chicken.position.x - moveDistance);
        this.chicken.position.x = newX;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        const newX = Math.min(this.roadRight, this.chicken.position.x + moveDistance);
        this.chicken.position.x = newX;
      }
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

    this.trees.forEach(tree => {
      tree.position.z += move;
      if (tree.position.z > 10) {
        const side = Math.random() > 0.5 ? 1 : -1;
        tree.position.x = side * (5 + Math.random() * 40);
        tree.position.z = -80;
      }
    });

    for (let i = this.eggs.length - 1; i >= 0; i--) {
      const egg = this.eggs[i];
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
    }

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.position.z += move;
      if (this.chicken && obs.position.distanceTo(this.chicken.position) < 1) {
        this.endGame();
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

  createParticles(position) {
    const particleGeom = new THREE.SphereGeometry(0.08, 8, 8);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 1 });
    const particles = [];
    
    for (let i = 0; i < 30; i++) {
      const p = new THREE.Mesh(particleGeom, particleMat.clone());
      p.position.copy(position);
      p.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        (Math.random() * 0.5) + 0.3,
        (Math.random() - 0.5) * 0.5
      );
      p.life = 1.0;
      this.scene.add(p);
      particles.push(p);
    }
    
    const animateParticles = () => {
      let stillAlive = false;
      particles.forEach(p => {
        if (p.life > 0) {
          stillAlive = true;
          p.position.add(p.velocity);
          p.velocity.y -= 0.015;
          p.life -= 0.02;
          p.material.opacity = p.life;
          p.scale.multiplyScalar(0.95);
        }
      });
      
      if (stillAlive) {
        requestAnimationFrame(animateParticles);
      } else {
        particles.forEach(p => {
          this.scene.remove(p);
          p.geometry.dispose();
          p.material.dispose();
        });
      }
    };
    
    animateParticles();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const loader = document.createElement('div');
  loader.id = 'loader';
  loader.textContent = 'Loading...';
  document.body.appendChild(loader);

  new Game();
});


    let scene = new THREE.Scene();
    let camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    let renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Luz
    let light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 7.5);
    light.castShadow = true;
    scene.add(light);

    let ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Plano de fundo
    let ground = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({color: 0x228B22, roughness: 0.8, metalness: 0.2})
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Galinha (modelo 3D .glb)
    let galinha, carModel;
    const loader = new THREE.GLTFLoader();
    loader.load('chicken.glb', function(gltf) {
      galinha = gltf.scene;
      galinha.scale.set(1, 1, 1);
      galinha.position.set(0, 0.5, 2);
      galinha.rotation.y = Math.PI / 2;
      galinha.traverse(function(node) {
        if (node.isMesh) { node.castShadow = true; }
      });
      scene.add(galinha);
    });

    loader.load('low-poly-car.glb', function(gltf) {
      carModel = gltf.scene;
      carModel.scale.set(2, 2, 2);
      carModel.traverse(function(node) {
        if (node.isMesh) { node.castShadow = true; }
      });
    });

    // Variáveis do jogo
    let ovos = [];
    let obstaculos = [];
    let score = 0;
    let gameStarted = false;
    let gameOver = false;
    let gameSpeed = 0.2;
let spawnRate = 2000;
let spawnIntervals = [];
    const scoreDiv = document.getElementById("score");
    const startScreen = document.getElementById("start-screen");
    const gameOverScreen = document.getElementById("game-over-screen");

    // Função para criar ovos
    function spawnOvo() {
      let ovo = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 16, 16),
        new THREE.MeshStandardMaterial({color: 0xFFFF00, roughness: 0.1, metalness: 0.5})
      );
      ovo.position.set(Math.random()*6 - 3, 0.3, -20);
      ovo.castShadow = true;
      scene.add(ovo);
      ovos.push(ovo);
    }

    // Função para criar obstáculos
    function spawnObstaculo() {
      if (!carModel) return;
      let obs = carModel.clone();
      obs.position.set(Math.random()*6 - 3, 0.2, -20);
      scene.add(obs);
      obstaculos.push(obs);
    }

    // Movimento da galinha
    document.addEventListener('keydown', e => {
      if (!galinha) return;
      if (e.key === 'ArrowLeft') galinha.position.x -= 1;
      if (e.key === 'ArrowRight') galinha.position.x += 1;
    });

    camera.position.set(0, 5, 5);
    camera.lookAt(0, 0, 0);

    // Game loop
    function animate() {
      if (gameOver) return;
      requestAnimationFrame(animate);

      if (!gameStarted) return;

      // Mover ovos e detectar coleta
      ovos.forEach((ovo, index) => {
        ovo.position.z += gameSpeed;
        if (galinha && ovo.position.distanceTo(galinha.position) < 1) {
          createParticles(ovo.position);
          scene.remove(ovo);
          ovos.splice(index, 1);
          score++;
          scoreDiv.innerText = `Ovos: ${score}`;
          // Aumentar a dificuldade
          if (score % 5 === 0) {
            gameSpeed += 0.05;
            spawnRate = Math.max(500, spawnRate - 200);
            updateSpawners();
          }
        }
      });

      // Mover obstáculos e detectar colisão
      obstaculos.forEach((obs, index) => {
        obs.position.z += gameSpeed;
        if (galinha && obs.position.distanceTo(galinha.position) < 1) {
          endGame();
        }
      });

      renderer.render(scene, camera);
    }

    function startGame() {
      gameStarted = true;
      startScreen.style.display = 'none';
      score = 0;
      scoreDiv.innerText = `Ovos: ${score}`;
      gameSpeed = 0.2;
      spawnRate = 2000;
      updateSpawners();
    }

    function endGame() {
      gameOver = true;
      gameOverScreen.style.display = 'block';
      spawnIntervals.forEach(clearInterval);
      spawnIntervals = [];
    }

    function updateSpawners() {
      spawnIntervals.forEach(clearInterval);
      spawnIntervals = [];
      spawnIntervals.push(setInterval(spawnOvo, spawnRate));
      spawnIntervals.push(setInterval(spawnObstaculo, spawnRate * 1.5));
    }

    function createParticles(position) {
      for (let i = 0; i < 20; i++) {
        let particle = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xFFFF00 })
        );
        particle.position.copy(position);
        particle.velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2
        );
        scene.add(particle);

        setTimeout(() => scene.remove(particle), 500);
      }
    }

    startScreen.addEventListener('click', () => {
      startGame();
    });

    gameOverScreen.addEventListener('click', () => {
      location.reload();
    });

    animate();

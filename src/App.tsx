import { useEffect, useRef } from "react";
import * as THREE from "three";
import { DRACOLoader, GLTFLoader, HDRLoader, OrbitControls } from "three/examples/jsm/Addons.js";
import WASD from './assets/WASD.png'
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);


  useEffect(() => {
    const canvas = canvasRef.current!;
    const renderer = new THREE.WebGLRenderer({ canvas });
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#333333");

    scene.environment = new HDRLoader().load("/model/venice_sunset_1k.hdr");
    scene.environment.mapping = THREE.EquirectangularReflectionMapping;
    scene.fog = new THREE.Fog(0x333333, 10, 15);

    const camera = new THREE.PerspectiveCamera(
      30,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(4.25, 1.4, -4.5);

    const controls = new OrbitControls(camera, canvas);
    controls.maxPolarAngle = THREE.MathUtils.degToRad(85);
    controls.maxDistance = 10;
    controls.minDistance = 3;
    controls.enablePan = false;

    const ground = new THREE.GridHelper(200, 400, "#121212", "#121212");
    scene.add(ground);


    let model: THREE.Object3D | null = null;

    const dracoLoader = new DRACOLoader();
    // dracoLoader.setDecoderPath('https://carcontroller1992.vercel.app/node_modules/three/examples/jsm/libs/draco/')
    // dracoLoader.setDecoderPath('node_modules/three/examples/jsm/libs/draco/')
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
    dracoLoader.setDecoderConfig({ type: 'js' });  // OR type: 'wasm'

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    const wheelNames = {
      fl: [
        "ppolysurface7_pporsche_911gt2_1993_wheel1a_3d_3dwheel1a_material1_0",
        "tsm_hub_l_0000_001_sm_hub_l_0000_001_mat_hub_tmat_hub1_0"
      ],
      fr: [
        "ppolysurface10_pporsche_911gt2_1993_wheel1a_3d_3dwheel1a_material1_0",
        "tsm_hub_r_0000_001_sm_hub_r_0000_001_mat_hub_009_tmat_hub1_0"
      ],
      rl: [
        "ppolysurface13_pporsche_911gt2_1993_wheel1a_3d_3dwheel1a_material1_0",
        "sm_hub_l_0000_001_sm_hub_l_0000_001_mat_hub_tmat_hub1_0"
      ],
      rr: [
        "ppolysurface16_pporsche_911gt2_1993_wheel1a_3d_3dwheel1a_material1_0",
        "sm_hub_r_0000_001_sm_hub_r_0000_001_mat_hub_009_tmat_hub1_0"
      ]
    }

    let wheels = {
      fl: new THREE.Group(),
      fr: new THREE.Group(),
      rl: new THREE.Group(),
      rr: new THREE.Group(),
    };

    function setupWheelRotationPivot(group: THREE.Group) {
      group.children.forEach(child => {
        const spinPivot = new THREE.Group();

        // Place the spin pivot exactly where the wheel mesh currently sits
        spinPivot.position.copy(child.position);

        // Reset mesh position so it becomes centered inside spinPivot
        child.position.set(0, 0, 0);

        // Reparent: group -> spinPivot -> mesh
        group.add(spinPivot);
        spinPivot.add(child);

        // Store a reference for later spinning
        (group as any).spinPivot = spinPivot;
      });
    }

    setupWheelRotationPivot(wheels.fl);
    setupWheelRotationPivot(wheels.fr);
    setupWheelRotationPivot(wheels.rl);
    setupWheelRotationPivot(wheels.rr);


    loader.load("/model/1992_porsche_911_964_turbo_s_36.glb", (gltf) => {
      model = gltf.scene;

      // 1. Apply the scale and rotation first to establish the car's final transform
      model.scale.set(60, 60, 60);
      model.rotation.y = Math.PI; // face forward direction

      // 2. Add the empty wheel groups as children of the main model
      model.add(wheels.fl, wheels.fr, wheels.rl, wheels.rr);

      // Temporary variables to store the center position of each wheel mesh
      const wheelPositions: Record<keyof typeof wheels, THREE.Vector3> = {
        fl: new THREE.Vector3(),
        fr: new THREE.Vector3(),
        rl: new THREE.Vector3(),
        rr: new THREE.Vector3(),
      };

      // 3. Traverse and reparent the wheel meshes and capture their world position
      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const name = child.name.toLowerCase();

          // Reparent the mesh using attach()
          if (wheelNames.fl.some(n => name.includes(n.toLowerCase()))) {
            wheels.fl.attach(child);
            // Use the position of the first component of the wheel to set the pivot
            child.getWorldPosition(wheelPositions.fl);
          }
          // Repeat for other wheels, making sure to capture the position only once per group
          else if (wheelNames.fr.some(n => name.includes(n.toLowerCase()))) {
            wheels.fr.attach(child);
            child.getWorldPosition(wheelPositions.fr);
          }
          else if (wheelNames.rl.some(n => name.includes(n.toLowerCase()))) {
            wheels.rl.attach(child);
            child.getWorldPosition(wheelPositions.rl);
          }
          else if (wheelNames.rr.some(n => name.includes(n.toLowerCase()))) {
            wheels.rr.attach(child);
            child.getWorldPosition(wheelPositions.rr);
          }
        }
      });

      // Temporary vector for world-to-local conversion
      const tempVector = new THREE.Vector3();

      // Function to set pivot point
      const setWheelPivot = (group: THREE.Group, worldPos: THREE.Vector3) => {
        tempVector.copy(worldPos);
        model!.worldToLocal(tempVector);
        group.position.copy(tempVector);

        group.children.forEach(child => {
          child.position.sub(tempVector);
        });
      };

      setWheelPivot(wheels.fl, wheelPositions.fl);
      setWheelPivot(wheels.fr, wheelPositions.fr);
      setWheelPivot(wheels.rl, wheelPositions.rl);
      setWheelPivot(wheels.rr, wheelPositions.rr);

      // 5. Add the model to the scene
      scene.add(model);
    });

    const keys: Record<string, boolean> = {};
    window.addEventListener("keydown", (e) => (keys[e.key.toLowerCase()] = true));
    window.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

    const clock = new THREE.Clock();
    const speed = 4;
    const rotationSpeed = 1;

    const offset = { x: 0.9, y: 1.4, z: -4.5 };
    const animate = () => {
      const delta = clock.getDelta();

      if (model) {
        const moveDir = new THREE.Vector3();


        // Forward/back movement based on rotation
        if (keys["w"]) moveDir.z = 1;
        if (keys["s"]) moveDir.z = -1;

        if (keys["w"] || keys["s"]) {
          const spin = (keys["w"] ? 1 : -1) * speed * delta;
          if (wheels.fl) wheels.fl.rotation.x -= spin;
          if (wheels.fr) wheels.fr.rotation.x -= spin;

          if (wheels.rl) wheels.rl.rotation.x -= spin;
          if (wheels.rr) wheels.rr.rotation.x -= spin;
        }


        // Rotation left / right
        if (moveDir.length() > 0) {
          if (keys["a"]) model.rotation.y += rotationSpeed * delta;
          if (keys["d"]) model.rotation.y -= rotationSpeed * delta;
        }

        const maxSteer = 0.09;
        if (keys["a"]) {
          if (wheels.fl) wheels.fl.rotation.y = maxSteer;
          if (wheels.fr) wheels.fr.rotation.y = maxSteer;
        } else if (keys["d"]) {
          if (wheels.fl) wheels.fl.rotation.y = -maxSteer;
          if (wheels.fr) wheels.fr.rotation.y = -maxSteer;
        } else {
          if (wheels.fl) wheels.fl.rotation.y = 0;
          if (wheels.fr) wheels.fr.rotation.y = 0;
        }

        moveDir.normalize().multiplyScalar(speed * delta);
        moveDir.applyQuaternion(model.quaternion);
        model.position.add(moveDir);

        // Smooth follow camera behind car
        const offsetVec = new THREE.Vector3(offset.x, offset.y, offset.z);
        offsetVec.applyQuaternion(model.quaternion);
        // const targetPos = model.position.clone().add(offsetVec);
        // camera.position.lerp(targetPos, 0.08);

        controls.target.copy(model.position);
      }

      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
    };
  }, []);



  function pressKey(key: string) {
    const event = new KeyboardEvent("keydown", { key });
    window.dispatchEvent(event);
  }

  function releaseKey(key: string) {
    const event = new KeyboardEvent("keyup", { key });
    window.dispatchEvent(event);
  }


  return <>
    <canvas ref={canvasRef} />
    {/* controller */}
    {/* Mobile Controls */}
    <div className="absolute bottom-6 w-full flex justify-between px-6 md:hidden z-20">

      {/* Left Steering Buttons */}
      <div className="flex gap-4">
        <button
          onTouchStart={() => pressKey("a")}
          onTouchEnd={() => releaseKey("a")}
          className="w-16 h-16 rounded-full bg-black/60 border border-white/30
                 text-white text-3xl font-bold flex items-center justify-center
                 active:scale-90 active:bg-green-500/60 active:border-green-300/80
                 shadow-xl backdrop-blur-md select-none touch-none"
        >
          ◀
        </button>

        <button
          onTouchStart={() => pressKey("d")}
          onTouchEnd={() => releaseKey("d")}
          className="w-16 h-16 rounded-full bg-black/60 border border-white/30
                 text-white text-3xl font-bold flex items-center justify-center
                 active:scale-90 active:bg-green-500/60 active:border-green-300/80
                 shadow-xl backdrop-blur-md select-none touch-none"
        >
          ▶
        </button>
      </div>

      {/* Drive Buttons */}
      <div className="flex gap-4">
        <button
          onTouchStart={() => pressKey("w")}
          onTouchEnd={() => releaseKey("w")}
          className="w-16 h-16 rounded-full bg-black/60 border border-white/30
                 text-white text-3xl font-bold flex items-center justify-center
                 active:scale-90 active:bg-green-500/60 active:border-green-300/80
                 shadow-xl backdrop-blur-md select-none touch-none"
        >
          ▲
        </button>

        <button
          onTouchStart={() => pressKey("s")}
          onTouchEnd={() => releaseKey("s")}
          className="w-16 h-16 rounded-full bg-black/60 border border-white/30
                 text-white text-3xl font-bold flex items-center justify-center
                 active:scale-90 active:bg-green-500/60 active:border-green-300/80
                 shadow-xl backdrop-blur-md select-none touch-none"
        >
          ▼
        </button>
      </div>

    </div>

    {/* aswd */}
    <div className="absolute top-2 left-2 h-12">
      <img src={WASD} alt="contaller" className="h-full" />
    </div>
  </>
}

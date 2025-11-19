import * as THREE from "three";
// import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import fragment from "./shader/fragment.glsl";
import vertex from "./shader/vertex.glsl";
import GUI from "lil-gui";

import { TimelineMax } from "gsap";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { createNoise3D } from "simplex-noise";

const noise3D = createNoise3D();

function noise(x, y, z) {
  return noise3D(x, y, z);
}
function computeCurl(x, y, z) {
  const eps = 1.0;
  const curl = new THREE.Vector3();

  const dFdy = (noise(x, y + eps, z) - noise(x, y - eps, z)) / (2 * eps);
  const dFdz = (noise(x, y, z + eps) - noise(x, y, z - eps)) / (2 * eps);
  const dFdx = (noise(x + eps, y, z) - noise(x - eps, y, z)) / (2 * eps);

  curl.x = dFdy - dFdz;
  curl.y = dFdz - dFdx;
  curl.z = dFdx - dFdy;

  return curl;
}

export default class Sketch {
  constructor(selector) {
    this.scene = new THREE.Scene();

    this.renderer = new THREE.WebGLRenderer();
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.width, this.height);
    this.renderer.setClearColor(0x000000, 1);

    this.container = document.getElementById("container");
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.container.appendChild(this.renderer.domElement);
  
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.emouse = new THREE.Vector2(0.0);
    this.temp = new THREE.Vector2(0.0);
    this.elasticMouse = new THREE.Vector2(0.0);
    this.elasticMouseVel = new THREE.Vector2(0.0);

    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.001,
      1000
    );

    // var frustumSize = 10;
    // var aspect = window.innerWidth / window.innerHeight;
    // this.camera = new THREE.OrthographicCamera( frustumSize * aspect / - 2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / - 2, -1000, 1000 );
    this.camera.position.set(0, 0, 2);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.time = 0;

    this.paused = false;

    this.setupResize();

    this.addObjects();
    this.rayCast();
    this.resize();
    this.render();
    // this.settings();
  }

  rayCast(){
    this.rayCastPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      // new THREE.MeshBasicMaterial({color: 0xcb0d02})
      this.material
    )

    this.light = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 20, 20),
      new THREE.MeshBasicMaterial({color: 0xffff00})
    )

    this.scene.add(this.rayCastPlane)
    this.scene.add(this.light)

    this.container.addEventListener('mousemove', (event) => {
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera)

      this.emouse.x = event.clientX;
      this.emouse.y = event.clientY;
      const intersect = this.raycaster.intersectObject(this.rayCastPlane);
      if(intersect.length > 0){
        let p = intersect[0].point;
        console.log(p)
        this.emouse.x = p.x;
        this.emouse.y = p.y;
      } 
    })
  }

  settings() {
    let that = this;
    this.settings = {
      time: 0,
    };
    this.gui = new dat.GUI();
    this.gui.add(this.settings, "time", 0, 100, 0.01);
  }

  setupResize() {
    window.addEventListener("resize", this.resize.bind(this));
  }

  resize() {
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;

    // image cover
    this.imageAspect = 853 / 1280;
    let a1;
    let a2;
    if (this.height / this.width > this.imageAspect) {
      a1 = (this.width / this.height) * this.imageAspect;
      a2 = 1;
    } else {
      a1 = 1;
      a2 = this.height / this.width / this.imageAspect;
    }

    this.material.uniforms.resolution.value.x = this.width;
    this.material.uniforms.resolution.value.y = this.height;
    this.material.uniforms.resolution.value.z = a1;
    this.material.uniforms.resolution.value.w = a2;

    // optional - cover with quad
    // const dist  = this.camera.position.z;
    // const height = 1;
    // this.camera.fov = 2*(180/Math.PI)*Math.atan(height/(2*dist));

    // // if(w/h>1) {
    // if(this.width/this.height>1){
    //   this.plane.scale.x = this.camera.aspect;
    //   // this.plane.scale.y = this.camera.aspect;
    // } else{
    //   this.plane.scale.y = 1/this.camera.aspect;
    // }

    this.camera.updateProjectionMatrix();
  }

getCurve(start) {
  let scale = 1.7;
  let points = [];
  points.push(start);
  let currentPoint = start.clone();
  
  for (let i = 0; i < 600; i++) {
    let v = computeCurl(currentPoint.x/scale, currentPoint.y/scale, currentPoint.z/scale);
    // let stepSize = 0.01;
    // currentPoint.x += v.x * stepSize;
    // currentPoint.y += v.y * stepSize;
    // currentPoint.z += v.z * stepSize;

    currentPoint.addScaledVector(v, 0.01);
    
    // Add the new point to the array
    points.push(currentPoint.clone());
  }
  return points;
}

  addObjects() {
    let that = this;
    this.material = new THREE.ShaderMaterial({
      extensions: {
        derivatives: "#extension GL_OES_standard_derivatives : enable",
      },
      side: THREE.DoubleSide,
      uniforms: {
        time: { type: "f", value: 0 },
        uLight: {value: new THREE.Vector3(0.,0.,0.)},
        resolution: { type: "v4", value: new THREE.Vector4() },
        uvRate1: {
          value: new THREE.Vector2(1, 1),
        },
      },
      // wireframe: true,
      // transparent: true,
      vertexShader: vertex,
      fragmentShader: fragment,
    });

    this.geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    for(let i = 0; i < 300; i++){
     let path = new THREE.CatmullRomCurve3(
      this.getCurve(new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5,
      ))
    );
    let geometry = new THREE.TubeGeometry(path, 600, 0.005, 8, false);

    let curve = new THREE.Mesh(geometry, this.material);
    this.scene.add(curve); 
    }
  }

  stop() {
    this.paused = true;
  }

  play() {
    this.paused = false;
    this.render();
  }

  render() {
    if (this.paused) return;
    this.time += 0.05;



    document.querySelector('.cursor').style.transform = `translate(${this.elasticMouse.x}px, ${this.elasticMouse.y}px)`
    this.temp.copy(this.emouse).sub(this.elasticMouse).multiplyScalar(.7);
    this.elasticMouseVel.add(this.temp);
    this.elasticMouseVel.multiplyScalar(0.6);

    this.elasticMouse.add(this.elasticMouseVel);
    this.light.position.x = this.elasticMouse.x;
    this.light.position.y = this.elasticMouse.y;

    this.material.uniforms.uLight.value = this.light.position;

    this.material.uniforms.time.value = this.time;
    requestAnimationFrame(this.render.bind(this));
    this.renderer.render(this.scene, this.camera);
  }
}

new Sketch("container");

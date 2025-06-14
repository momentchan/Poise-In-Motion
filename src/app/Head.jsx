import { useFBX } from "@react-three/drei";
import { useFrame, useLoader } from '@react-three/fiber'
import { useRef, useEffect, useState } from 'react'
import { useControls } from 'leva'
import * as THREE from 'three'

import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import simplexNoiseGLSL from '../r3f-gist/shader/cginc/noise/simplexNoise.glsl?raw'  //
import utilityGLSL from '../r3f-gist/shader/cginc/utility.glsl?raw'
import mathGLSL from '../r3f-gist/shader/cginc/math.glsl?raw'

// Custom shader material for normal visualization
const NormalShaderMaterial = {
    uniforms: {
        time: { value: 0 },
        triScale: { value: 1.0 },
        mosaic: { value: 0 },
        progress: { value: 0 },
        speed: { value: 0.5 },
    },
    vertexShader: /* glsl */`
        ${simplexNoiseGLSL}
        ${utilityGLSL}
        ${mathGLSL}     
        uniform float triScale;
        varying vec3 vNormal;
        varying vec3 vPosition;
        attribute vec3 center;
        uniform float mosaic;
        uniform float time;
        uniform float progress;
        uniform float speed;
        
        float PI = 3.14159265358979323846;


        void main() {   
            vNormal = normal;
            vPosition = position;

            // TRIANGLE
            vec3 pos = position;
            pos = (pos - center) * triScale + center;

            // PIXELATED
            float transformStart = -(position.y / 15.0 + 1.0 ) * 0.5; // -1.0~ 0.0
            float s = backout(clamp(transformStart + progress * 2.0, 0.0, 1.0), 10.0);

            vec3 pixelatedPos = floor(pos * mosaic + 0.5) / mosaic;
            pos = mix(pos, pixelatedPos,s);


            // NOISE
            float noise = simplexNoise4d(vec4(pos *0.02, time * speed ));

            float rotate = noise * PI * 0.1;

            pos = rotate3D(pos, vec3(1, 0, 0), rotate);
            pos = rotate3D(pos, vec3(0, 1, 0), rotate);
            pos = rotate3D(pos, vec3(0, 1, 1), rotate);

            float scale = 1. + noise * 0.1;

            pos *= scale;

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: /* glsl */`
        varying vec3 vNormal;
        varying vec3 vPosition;

        void main() {
    
            gl_FragColor = vec4(vNormal, 1.0);
            // gl_FragColor = vec4(normalize(vNormal) * 0.5 + 0.5, 1.0);
        }
    `
};

export default function Head() {
    const materialRef = useRef()

    const [mergedMesh, setMergedMesh] = useState(null)

    const { triScale, mosaic, progress, speed } = useControls('Normal Material', {
        triScale: {
            value: 1.0,
            min: 0.0,
            max: 1.0,
            step: 0.1
        },
        mosaic: {
            value: 0,
            min: 0.15,
            max: 1,
            step: 0.01
        },
        progress: {
            value: 0,
            min: 0,
            max: 1,
            step: 0.01
        },
        speed: {
            value: 0.5,
            min: 0.0,
            max: 2.0,
            step: 0.1
        }
    });

    useEffect(() => {
        const loader = new FBXLoader()
        loader.load('/free_head.fbx', (fbx) => {

            materialRef.current = new THREE.ShaderMaterial({
                ...NormalShaderMaterial,
                side: THREE.DoubleSide
            });

            const geometries = []

            fbx.traverse((child) => {
                if (child.isMesh) {
                    const cloned = child.geometry.clone()
                    cloned.applyMatrix4(child.matrixWorld)
                    geometries.push(cloned)
                }
            });

            if (geometries.length > 0) {
                const mergedGeometry = mergeGeometries(geometries, false).toNonIndexed()

                mergedGeometry.computeBoundingBox()
                const center = new THREE.Vector3()
                mergedGeometry.boundingBox.getCenter(center)
                mergedGeometry.translate(-center.x, -center.y, -center.z)

                const pos = mergedGeometry.attributes.position.array

                // calculate center position of each triangle
                let centers = []
                for (let i = 0; i < pos.length; i += 9) {
                    const centerX = (pos[i] + pos[i + 3] + pos[i + 6]) / 3
                    const centerY = (pos[i + 1] + pos[i + 4] + pos[i + 7]) / 3
                    const centerZ = (pos[i + 2] + pos[i + 5] + pos[i + 8]) / 3

                    centers.push(centerX, centerY, centerZ)
                    centers.push(centerX, centerY, centerZ)
                    centers.push(centerX, centerY, centerZ)
                }

                mergedGeometry.setAttribute('center', new THREE.BufferAttribute(new Float32Array(centers), 3))

                const merged = new THREE.Mesh(mergedGeometry, materialRef.current)
                setMergedMesh(merged)
            }
        })
    }, []);


    useFrame((state) => {
        if (mergedMesh) {
            // mergedMesh.position.x = Math.sin(state.clock.elapsedTime * 2) * 1
        }
        if (materialRef.current) {
            materialRef.current.uniforms.triScale.value = triScale;
            materialRef.current.uniforms.mosaic.value = mosaic;
            materialRef.current.uniforms.time.value = state.clock.elapsedTime;
            materialRef.current.uniforms.progress.value = progress;
            materialRef.current.uniforms.speed.value = speed;
        }
    });

    return (
        mergedMesh ? <primitive object={mergedMesh} scale={0.1} /> : null
    )
}

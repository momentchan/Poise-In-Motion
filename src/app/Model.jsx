import { useFBX } from "@react-three/drei";
import { useFrame, useLoader } from '@react-three/fiber'
import { useRef, useEffect, useState } from 'react'
import { useControls } from 'leva'
import * as THREE from 'three'

import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';


// Custom shader material for normal visualization
const NormalShaderMaterial = {
    uniforms: {
        time: { value: 0 },
        intensity: { value: 1.0 }
    },
    vertexShader: /* glsl */`
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
            vNormal = normalize(normalMatrix * normal);
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */`
        varying vec3 vNormal;
        varying vec3 vPosition;

        void main() {
    
            gl_FragColor = vec4(vNormal, 1.0);
            gl_FragColor = vec4(normalize(vNormal) * 0.5 + 0.5, 1.0);
        }
    `
};

export default function Model() {
    const materialRef = useRef()

    const [mergedMesh, setMergedMesh] = useState(null)

    const { intensity } = useControls('Normal Material', {
        intensity: {
            value: 1.0,
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
                const mergedGeometry = mergeGeometries(geometries, false)

                mergedGeometry.computeBoundingBox()
                const center = new THREE.Vector3()
                mergedGeometry.boundingBox.getCenter(center)
                mergedGeometry.translate(-center.x, -center.y, -center.z)

                const merged = new THREE.Mesh(mergedGeometry, materialRef.current)
                setMergedMesh(merged)
            }
        })
    }, []);


    useFrame((state) => {
        if (materialRef.current) {
            // materialRef.current.uniforms.time.value = state.clock.elapsedTime;
            // materialRef.current.uniforms.intensity.value = intensity;
        }
    });

    return (
        mergedMesh ? <primitive object={mergedMesh} scale={0.1} /> : null
    )
}

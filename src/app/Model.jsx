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
        intensity: { value: 1.0 },
        triScale: { value: 1.0 }
    },
    vertexShader: /* glsl */`

        uniform float triScale;
        varying vec3 vNormal;
        varying vec3 vPosition;
        attribute vec3 center;

        void main() {
            vNormal = normal;
            vPosition = position;

            vec3 pos = position;

            pos = (pos - center) * triScale + center;


            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
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

    const { intensity, triScale } = useControls('Normal Material', {
        intensity: {
            value: 1.0,
            min: 0.0,
            max: 2.0,
            step: 0.1
        },
        triScale: {
            value: 1.0,
            min: 0.0,
            max: 1.0,
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
                for(let i = 0; i < pos.length; i += 9) {
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
        if (materialRef.current) {
            materialRef.current.uniforms.triScale.value = triScale;
        }
    });

    return (
        mergedMesh ? <primitive object={mergedMesh} scale={0.1} /> : null
    )
}

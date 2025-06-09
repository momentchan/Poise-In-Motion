import { CameraControls } from "@react-three/drei";
import { Canvas } from '@react-three/fiber'
import { useRef, useEffect } from 'react'
import Utilities from "../r3f-gist/utility/Utilities";
import { CustomShaderMaterial } from "../r3f-gist/shader/CustomShaderMaterial";
import fragmentShader from "../shader/test/fragment.glsl";
import { useControls } from 'leva'

function BasicMesh() {
    const materialRef = useRef()

    const { alpha } = useControls('Torus Material', {
        alpha: {
            value: 0.5,
            min: 0,
            max: 1,
            step: 0.01
        }
    })

    return (
        <mesh>
            <planeGeometry args={[2, 2]} />
            <CustomShaderMaterial
                ref={materialRef}
                fragmentShader={fragmentShader}
                uniforms={{ uAlpha: alpha,
                }}
                transparent={true}
                side={2}
            />
        </mesh>
    )
}

export default function App() {
    return <>
        <Canvas
            shadows
            camera={{
                fov: 45,
                near: 0.1,
                far: 200,
                position: [4, 2, 6]
            }}
            gl={{ preserveDrawingBuffer: true }}
        >
            <CameraControls makeDefault />
            <BasicMesh />
            <Utilities />
        </Canvas>
    </>
}
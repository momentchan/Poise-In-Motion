varying vec2 vUv;
uniform float uAlpha;

void main() {
    vec3 color = vec3(vUv, 0.0);
    gl_FragColor = vec4(color, uAlpha);
}
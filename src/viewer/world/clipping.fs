uniform float dim;

void main() {
  vec2 uv = (gl_FragCoord.xy / resolution.xy);

  vec2 texelWidth = vec2(1. / (dim*3.), 0.);

  vec3 p1 = texture2D(vertexTexture, uv / vec2(3., 1.)).xyz;
  vec3 p2 = texture2D(vertexTexture, uv / vec2(3., 1.) + texelWidth).xyz;
  vec3 p3 = texture2D(vertexTexture, uv / vec2(3., 1.) + texelWidth*2.).xyz;

  gl_FragColor = vec4(p1, 1.0);
}
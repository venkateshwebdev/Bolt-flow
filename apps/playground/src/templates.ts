import { createDocument, type BoltDocument, type BoltNode } from 'bolt-flow-core';

function node(id: string, label: string, description: string, x: number, y: number, kind: string, tag: string, accent: string): BoltNode {
  return { id, type: 'bolt', position: { x, y }, width: 190, height: 112, data: { label, description, kind, tag, accent } };
}
export function launchTemplate(): BoltDocument {
  return createDocument({ id: 'product-launch', name: 'Product launch', nodes: [
    node('idea', 'A little spark', 'Every great thing starts with an idea.', 0, 170, 'idea', 'THE BIG IDEA', 'purple'),
    node('research', 'Discover & explore', 'Talk to people. Find the real problem.', 350, 40, 'research', '01 · DISCOVERY', 'blue'),
    node('design', 'Make it tangible', 'Turn what-ifs into something you can touch.', 350, 295, 'design', '02 · DESIGN', 'pink'),
    node('build', 'Bring it to life', 'Small iterations. Thoughtful details.', 700, 40, 'build', '03 · BUILD', 'orange'),
    node('feedback', 'Listen & refine', 'A little feedback goes a long way.', 700, 295, 'feedback', '04 · LEARN', 'green'),
    node('launch', 'Ready for the world', 'Ship something worth sharing.', 1050, 170, 'launch', 'LIFT OFF', 'purple'),
  ], edges: [
    { id: 'e1', source: 'idea', target: 'research' },
    { id: 'e2', source: 'idea', target: 'design' },
    { id: 'e3', source: 'research', target: 'build' },
    { id: 'e4', source: 'design', target: 'feedback' },
    { id: 'e5', source: 'build', target: 'launch' },
    { id: 'e6', source: 'feedback', target: 'launch' },
  ] });
}
export function architectureTemplate(): BoltDocument {
  return createDocument({ id: 'system-map', name: 'System architecture', nodes: [
    node('client', 'Web application', 'The experience your customers see.', 0, 120, 'design', 'CLIENT', 'blue'),
    node('api', 'API gateway', 'One entry point. Clear boundaries.', 350, 120, 'build', 'GATEWAY', 'purple'),
    node('auth', 'Identity service', 'Authentication and access control.', 700, 0, 'research', 'SERVICE', 'orange'),
    node('data', 'Data layer', 'A reliable home for your data.', 700, 260, 'feedback', 'STORAGE', 'green'),
  ], edges: [
    { id: 'a1', source: 'client', target: 'api' },
    { id: 'a2', source: 'api', target: 'auth' },
    { id: 'a3', source: 'api', target: 'data' },
  ] });
}
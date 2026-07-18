const PREAPPROVED_WEB_FETCH_TARGETS = [
  'platform.claude.com', 'code.claude.com', 'modelcontextprotocol.io', 'github.com/anthropics', 'agentskills.io',
  'docs.python.org', 'en.cppreference.com', 'docs.oracle.com', 'learn.microsoft.com', 'developer.mozilla.org',
  'go.dev', 'pkg.go.dev', 'www.php.net', 'docs.swift.org', 'kotlinlang.org', 'ruby-doc.org', 'doc.rust-lang.org',
  'www.typescriptlang.org', 'react.dev', 'angular.io', 'vuejs.org', 'nextjs.org', 'expressjs.com', 'nodejs.org',
  'bun.sh', 'jquery.com', 'getbootstrap.com', 'tailwindcss.com', 'd3js.org', 'threejs.org', 'redux.js.org',
  'webpack.js.org', 'jestjs.io', 'reactrouter.com', 'docs.djangoproject.com', 'flask.palletsprojects.com',
  'fastapi.tiangolo.com', 'pandas.pydata.org', 'numpy.org', 'www.tensorflow.org', 'pytorch.org', 'scikit-learn.org',
  'matplotlib.org', 'requests.readthedocs.io', 'jupyter.org', 'laravel.com', 'symfony.com', 'wordpress.org',
  'docs.spring.io', 'hibernate.org', 'tomcat.apache.org', 'gradle.org', 'maven.apache.org', 'asp.net',
  'dotnet.microsoft.com', 'nuget.org', 'blazor.net', 'reactnative.dev', 'docs.flutter.dev', 'developer.apple.com',
  'developer.android.com', 'keras.io', 'spark.apache.org', 'huggingface.co', 'www.kaggle.com', 'www.mongodb.com',
  'redis.io', 'www.postgresql.org', 'dev.mysql.com', 'www.sqlite.org', 'graphql.org', 'prisma.io',
  'docs.aws.amazon.com', 'cloud.google.com', 'kubernetes.io', 'www.docker.com', 'www.terraform.io', 'www.ansible.com',
  'vercel.com/docs', 'docs.netlify.com', 'devcenter.heroku.com', 'cypress.io', 'selenium.dev', 'docs.unity.com',
  'docs.unrealengine.com', 'git-scm.com', 'nginx.org', 'httpd.apache.org',
] as const;

const HOSTS = new Set<string>();
const PATHS = new Map<string, string[]>();
for (const target of PREAPPROVED_WEB_FETCH_TARGETS) {
  const slash = target.indexOf('/');
  if (slash < 0) HOSTS.add(target);
  else {
    const host = target.slice(0, slash);
    const paths = PATHS.get(host) ?? [];
    paths.push(target.slice(slash));
    PATHS.set(host, paths);
  }
}

export function isPreapprovedWebFetchUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase();
    if (HOSTS.has(hostname)) return true;
    return (PATHS.get(hostname) ?? []).some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));
  } catch {
    return false;
  }
}

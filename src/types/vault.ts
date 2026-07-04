export type TreeNode = {
  name: string;
  path: string;
  is_dir: boolean;
  children: TreeNode[];
};

export type Frontmatter = {
  id: string;
  created: string;
  updated: string;
  tags: string[];
};

export type NoteFile = {
  frontmatter: Frontmatter;
  body: string;
};

export type SearchHit = {
  path: string;
  line_number: number;
  snippet: string;
};

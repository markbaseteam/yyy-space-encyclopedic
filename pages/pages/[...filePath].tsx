import cytoscape from "cytoscape";
import dirTree from "directory-tree";
import fs from "fs";
import matter from "gray-matter";
import { marked } from "marked";
import { GetStaticPaths, GetStaticProps } from "next";
import { NextSeo } from "next-seo";
import dynamic from "next/dynamic";
import Link from "next/link";
import path from "path";
import React, { useEffect, useState } from "react";
import useSWR from "swr";
import styles from "../../assets/styles/Home.module.css";
import { Post, PostMetadata } from "../../utils/types";

const Graph = dynamic(() => import("../../components/Graph"), {
  ssr: false,
});

const FilePage = (props: { post: Post }) => {
  const [graphPosts, setGraphPosts] = useState<Post[]>([]);
  const [currentPost, setCurrentPost] = useState<Post>();
  const [graphElements, setGraphElements] = useState<
    cytoscape.ElementDefinition[]
  >([]);
  const [postContent, setPostContent] = useState<string>(
    marked(props.post.content)
  );

  const getGraphElements = (currentPost: Post) => {
    const elements = [] as cytoscape.ElementDefinition[];

    elements.push({
      data: {
        id: currentPost.url,
        label: currentPost.title,
      },
      selected: true,
    });

    for (const backlinkedPostUrl of currentPost.backlinks) {
      // Get backlinked post from graph posts
      const backlinkedPosts = graphPosts.filter((p) => {
        return p.url === backlinkedPostUrl;
      });

      if (backlinkedPosts.length > 0) {
        elements.push({
          data: {
            id: backlinkedPosts[0].url,
            label: backlinkedPosts[0].url.split("/").pop(),
          },
        });
        elements.push({
          data: {
            source: backlinkedPosts[0].url,
            target: currentPost.url,
          },
        });

        for (const l2link of backlinkedPosts[0].links) {
          elements.push({
            data: {
              id: l2link,
              label: l2link.split("/").pop(),
            },
          });
          elements.push({
            data: { source: l2link, target: backlinkedPosts[0].url },
          });
        }

        for (const l2backlink of backlinkedPosts[0].backlinks) {
          elements.push({
            data: {
              id: l2backlink,
              label: l2backlink.split("/").pop(),
            },
          });
          elements.push({
            data: { source: l2backlink, target: backlinkedPosts[0].url },
          });
        }
      }
    }

    for (const linkedPostUrl of currentPost.links) {
      // Get linked post from graph posts
      const linkedPosts = graphPosts.filter((p) => {
        return p.url === linkedPostUrl;
      });

      if (linkedPosts.length > 0) {
        elements.push({
          data: {
            id: linkedPosts[0].url,
            label: linkedPosts[0].url.split("/").pop(),
          },
        });
        elements.push({
          data: { source: linkedPosts[0].url, target: currentPost.url },
        });

        for (const l2link of linkedPosts[0].links) {
          elements.push({
            data: {
              id: l2link,
              label: l2link.split("/").pop(),
            },
          });
          elements.push({
            data: { source: l2link, target: linkedPosts[0].url },
          });
        }

        for (const l2backlink of linkedPosts[0].backlinks) {
          elements.push({
            data: {
              id: l2backlink,
              label: l2backlink.split("/").pop(),
            },
          });
          elements.push({
            data: { source: l2backlink, target: linkedPosts[0].url },
          });
        }
      }
    }

    setGraphElements(elements);
  };

  const fetcher = (endpoint: string) =>
    fetch(endpoint).then((res) => res.json());

  const { data, isValidating, mutate, error } = useSWR(
    "/api/content-graph",
    fetcher
  );

  useEffect(() => {
    setPostContent(marked(props.post.content));
    if (
      !sessionStorage.getItem("graph") ||
      sessionStorage.getItem("graph") === "[]"
    ) {
      mutate();
    } else {
      const graphData = JSON.parse(sessionStorage.getItem("graph") ?? "[]");
      setGraphPosts(graphData);

      // Get current post from graph posts
      const currentPosts = graphData.filter((p: Post) => {
        return p.url === props.post.url;
      });

      if (currentPosts.length > 0) {
        setCurrentPost(currentPosts[0]);
      }
    }
  }, [props]);

  useEffect(() => {
    if (data && !error) {
      sessionStorage.setItem("graph", JSON.stringify(data.graph));
      setGraphPosts(data.graph);

      // Get current post from graph posts
      const currentPosts = data.graph.filter((p: Post) => {
        return p.url === props.post.url;
      });

      if (currentPosts.length > 0) {
        setCurrentPost(currentPosts[0]);
      }
    }
  }, [data]);

  useEffect(() => {
    if (currentPost) {
      getGraphElements(currentPost);
    } else {
      setGraphElements([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPost]);

  useEffect(() => {
    setGraphPosts(JSON.parse(sessionStorage.getItem("graph") ?? "[]"));
  }, []);

  return (
    <div className={styles.container}>
      <NextSeo
        title={
          (props.post.metadata?.title ?? props.post.title) +
          " - " +
          process.env.NEXT_PUBLIC_PROJECT_NAME
        }
        description={
          props.post.metadata?.description ??
          props.post.content.substring(0, 280)
        }
        canonical={props.post.metadata?.canonical}
        openGraph={{
          url: props.post.metadata?.ogUrl,
          title: props.post.metadata?.ogTitle,
          description: props.post.metadata?.ogDescription,
          images: [{ url: props.post.metadata?.ogImage ?? "" }],
          site_name: props.post.metadata?.ogSitename,
        }}
        twitter={{
          handle: props.post.metadata?.twitterHandle,
          site: props.post.metadata?.twitterSite,
          cardType: props.post.metadata?.twitterCardType,
        }}
      />
      <div className="prose prose-md prose-invert text-gray-300">
        {postContent === "" && (
          <div>
            <h1>{props.post.title}</h1>
          </div>
        )}
        <div></div>
        <div dangerouslySetInnerHTML={{ __html: postContent }} />
      </div>
      <div>
        {!isValidating &&
          (graphElements.length > 0 ||
            (currentPost && currentPost.backlinks.length > 0)) && (
            <div>
              <hr className="my-12 w-1/3 border border-neutral-600" />
              <div>
                {currentPost && currentPost.backlinks.length > 0 && (
                  <>
                    <h3 className="text-xl font-bold mb-4">Backlinks</h3>
                    <div>
                      {currentPost.backlinks.map((link, i) => {
                        return (
                          <div key={i}>
                            <Link href={link}>
                              <a className="px-1 my-1 rounded-sm bg-indigo-200 hover:bg-indigo-300 text-gray-800 hover:text-gray-600 opacity-70">
                                {link.split("/").pop()}
                              </a>
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                {graphElements.length > 0 && (
                  <>
                    <h3 className="text-xl font-bold my-4">Graph</h3>
                    <div className="border-2 rounded-md border-neutral-600 w-100 h-64 mt-4">
                      <Graph elements={graphElements} />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

export const getStaticPaths: GetStaticPaths = async () => {
  let filePaths = getNavigationPaths();

  filePaths = filePaths?.map((filePath) => {
    return {
      params: {
        filePath: filePath.params.filePath[0].split("/"),
      },
    };
  });

  return {
    paths: filePaths ?? [],
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps = async (context) => {
  if (context.params?.filePath) {
    return {
      props: {
        post: getPost((context.params?.filePath as string[]).join("/")),
      },
    };
  } else {
    return {
      props: {
        post: null,
      },
    };
  }
};

export default FilePage;

// Internal functions
const getPost = (postPath: string) => {
  const resolvedPath = "content/" + postPath + ".md";

  try {
    const mdFile = fs.readFileSync(path.resolve(resolvedPath), "utf-8");

    try {
      const md = matter(mdFile, {});

      const metadata = {
        title: md.data.hasOwnProperty("title")
          ? md.data.title
          : postPath.split("/")[postPath.split("/").length - 1],
        description: md.data.hasOwnProperty("description")
          ? md.data.description
          : md.content.substring(0, 280),
      } as PostMetadata;

      if (md.data.hasOwnProperty("canonical")) {
        metadata.canonical = md.data.canonical;
      }

      if (md.data.hasOwnProperty("ogUrl")) {
        metadata.ogUrl = md.data.ogUrl;
      }

      if (md.data.hasOwnProperty("ogTitle")) {
        metadata.ogTitle = md.data.ogTitle;
      }

      if (md.data.hasOwnProperty("ogDescription")) {
        metadata.ogDescription = md.data.ogDescription;
      }

      if (md.data.hasOwnProperty("ogImage")) {
        metadata.ogImage = md.data.ogImage;
      }

      if (md.data.hasOwnProperty("ogSitename")) {
        metadata.ogSitename = md.data.ogSitename;
      }

      if (md.data.hasOwnProperty("twitterHandle")) {
        metadata.twitterHandle = md.data.twitterHandle;
      }

      if (md.data.hasOwnProperty("twitterSite")) {
        metadata.twitterSite = md.data.twitterSite;
      }

      if (md.data.hasOwnProperty("twitterCardType")) {
        metadata.twitterCardType = md.data.twitterCardType;
      }

      return {
        url: postPath,
        title: postPath.split("/")[postPath.split("/").length - 1],
        content: md.content,
        links: [],
        backlinks: [],
        metadata: metadata,
      } as Post;
    } catch (error) {
      console.error("Error occurred in getPost - ", error);
      return {
        url: postPath,
        title: postPath.split("/")[postPath.split("/").length - 1],
        content: mdFile,
        links: [],
        backlinks: [],
        metadata: {
          title: postPath.split("/")[postPath.split("/").length - 1],
          description: mdFile.substring(0, 280),
        },
      } as Post;
    }
  } catch (error) {
    return null;
  }
};

const getNavigationPaths = () => {
  const directoryTree = dirTree("content", { extensions: /\.md/ });

  return directoryTree.children?.flatMap((item) => {
    if (item.hasOwnProperty("children")) {
      // Iterate on it with child function
      return getNavigationChildrenPaths(item, "", 0);
    } else {
      return {
        params: {
          filePath: [item.name.replace(".md", "")],
        },
      };
    }
  });
};

const getNavigationChildrenPaths = (
  item: dirTree.DirectoryTree,
  filePath: string,
  depth: number
):
  | {
      params: {
        filePath: string[];
      };
    }
  | {
      params: {
        filePath: string[];
      };
    }[] => {
  if (item.children) {
    return item.children.flatMap((child) => {
      return getNavigationChildrenPaths(
        child,
        filePath
          ? filePath + "/" + item.name.replace(".md", "")
          : item.name.replace(".md", ""),
        depth + 1
      );
    });
  } else {
    return {
      params: {
        filePath: [
          filePath
            ? filePath + "/" + item.name.replace(".md", "")
            : item.name.replace(".md", ""),
        ],
      },
    };
  }
};

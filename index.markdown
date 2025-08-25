---
layout: home
title: "欢迎来到我的网站"
description: "这是我的个人 GitHub Pages 网站"
---

# 欢迎来到我的个人网站！👋

这里是我的博客主页，使用 **Jekyll + GitHub Pages** 搭建。  

你可以在这里写文章、分享项目或者展示作品。  

## 最新文章

{% for post in site.posts %}
- [{{ post.title }}]({{ post.url }}) - {{ post.date | date: "%Y-%m-%d" }}
{% endfor %}

---

## 关于我

我是一名热爱编程和设计的小伙伴，喜欢探索 **网页制作、AI 创作和图像处理**。  

你可以通过这个网站查看我的最新项目和学习笔记。

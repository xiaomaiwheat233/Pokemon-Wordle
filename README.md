# 宝可梦弗一把 🎯

一个宝可梦版的「猜猜我是谁」小游戏（Pokémon Wordle）。系统随机抽取一只宝可梦，你在 8 次机会内通过种族值、属性、世代、特性等逐项对比反馈猜出它。

## ✨ 玩法

- 选择参与世代（全部 / 第一至第九世代），点击「开始竞猜」
- 每次猜测后逐项给出反馈：<b>绿色</b> = 正确 · <b>黄色</b> = 接近 · <b>灰色</b> = 不对，数值附 <b>↑</b>（答案更高）/ <b>↓</b>（答案更低）
- 最后一次竞猜时给出目标剪影图
- 每局限用一次提示（三选一）：名字字数 / 名字第一个字 / 自动填入一只 ≥ 半数数据吻合的宝可梦（消耗一次竞猜）
- 可随时「🏳️ 放弃」直接公布答案

## 🚀 运行

纯静态页面，无需构建：直接用浏览器打开 `[index.html](https://xiaomaiwheat233.github.io/Pokemon-Wordle/)` 即可。

开发相关：

```bash
python tools/build_data.py   # 从 pokemon-dataset-zh 数据重新生成 js/pokedex-data.js
node tools/test_logic.js     # 无头逻辑测试（模拟完整对局流程）
```

## 📊 数据来源与致谢

宝可梦数据来自 [42arch/pokemon-dataset-zh](https://github.com/42arch/pokemon-dataset-zh)（MIT License，数据整理自[神奇宝贝百科](https://wiki.52poke.com/wiki/主页)）。本仓库 `pokemon-dataset-zh-main/` 目录为其内容的本地副本，其中 `LICENSE` 及版权声明均随附保留。感谢原作者整理的中文图鉴数据集！

## ⚠️ 免责声明

本项目仅供个人学习交流使用。宝可梦（Pokémon）相关名称、图片、设定版权归任天堂 / Game Freak / The Pokémon Company 所有，图片为官方绘图，仅作游戏展示用途；如有版权问题请联系删除。

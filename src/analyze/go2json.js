const fs = require("fs");

function go2json() {
  let that = this;

  const SIGIL = [
    /*TRIPLE*/ "<<=",">>=",
    /*DOUBLE*/ "+=","-=","*=","/=","%=","++","--",":=","==","&&","||",">=","<=","<<",">>","&=","^=","|=","!=","<-",
    /*SINGLE*/ "=","+","-","*","/","%","{","}","[","]","(",")",",","&","|","!","<",">","^",";",":"
  ];
  const OPERATOR = SIGIL.filter(x=>!["{","}","[","]",";",":=","="].includes(x));
  const DOT = ".";
  const WHITESPACE = " \t";
  const NEWLINE = "\n\r";
  const NUMBER = "01234567890";
  const QUOTE = "\"'`";
  const PRIMTYPES = ["int","byte","bool","float32","float64","int8","int32","int16","int64","uint8","uint32","uint16","uint64","rune","string"];

  function go2tokens(src){
    let ident = "";
    let isNum = false;
    let tokens = [];
    let i = 0;
    let line = 1;
    let col = 1;
    let sigilset = Array.from(new Set(SIGIL.join("")));

    function newlineMaybe(){
      if (tokens.length && tokens[tokens.length-1].tag != "newline"){
        tokens.push({tag:"newline",value:"\n", line: line, col: col});
      }
    }
    function pushIdent(){
      if (ident.length){
        tokens.push({tag:isNum?"number":"ident",value:ident, line: line, col: col - ident.length});
        ident="";
        isNum = false;
      }
    }
    
    function advancePosition(char) {
      if (NEWLINE.includes(char)) {
        line++;
        col = 1;
      } else {
        col++;
      }
    }
    while (i < src.length){
      // console.log(i,src[i])
      if (WHITESPACE.includes(src[i])){
        pushIdent();
        advancePosition(src[i]);
        i++;
      }else if (NEWLINE.includes(src[i])){
        pushIdent();
        newlineMaybe();
        advancePosition(src[i]);
        i++;
      }else if (src[i]=="/" && src[i+1]=="/"){
        var cmt = "";
        while (src[i] != "\n" && i < src.length){
          cmt += src[i];
          advancePosition(src[i]);
          i++;
        }
        // tokens.push({tag:"comment",value:cmt});
        newlineMaybe();
        if (i < src.length) {
          advancePosition(src[i]);
          i++;
        }
      }else if (src[i] == "/" && src[i+1] == "*"){
        advancePosition(src[i]);
        advancePosition(src[i+1]);
        i+=2;
        let lvl = 0;
        while (true){
          if (i > src.length*2){
            throw "Unexpected EOF"
          }
          if (src[i-1]=="/" && src[i] == "*"){
            lvl ++;
          }
          if (src[i-1] == "*" && src[i] == "/"){
            if (!lvl){
              advancePosition(src[i]);
              i++;
              break;
            }
            lvl --;
          }
          advancePosition(src[i]);
          i++;
        }
      }else if (QUOTE.includes(src[i])){
        let startLine = line;
        let startCol = col;
        let j = i+1;
        advancePosition(src[i]); // advance for opening quote
        while (true){
          if (src[j] == "\\"){
            advancePosition(src[j]);
            j++;
            if (j < src.length) {
              advancePosition(src[j]);
              j++;
            }
          }else if (src[j] == src[i]){
            advancePosition(src[j]); // advance for closing quote
            break;
          } else {
            advancePosition(src[j]);
            j++;
          }
        }
        j++;
        tokens.push({tag:src[i]=="'"?"char":"string",value:src.slice(i,j), line: startLine, col: startCol});
        i=j;
      }else if (src[i] == "." && src[i+1] == "." && src[i+2] == "."){
        pushIdent();
        tokens.push({tag:"sigil",value:"...", line: line, col: col});
        advancePosition(src[i]);
        advancePosition(src[i+1]);
        advancePosition(src[i+2]);
        i+=3;
      }else if (sigilset.includes(src[i])){
        if (src[i] == "-" || src[i] == "+"){ // e.g. 1e+8 1E-9
          if (isNum && ident[ident.length-1]=="e"||ident[ident.length-1]=="E"){
            ident += src[i];
            advancePosition(src[i]);
            i++;
            continue;
          }
        }
        pushIdent();
        let done = false;
        for (var j = 0; j < SIGIL.length; j++){
          let l = SIGIL[j].length;
          let ok = true;
          for (var k = 0; k < l; k++){
            if (src[i+k] != SIGIL[j][k]){
              ok = false;
              break;
            }
          }
          if (ok){
            tokens.push({tag:"sigil",value:SIGIL[j], line: line, col: col});
            for (let k = 0; k < l; k++) {
              advancePosition(src[i+k]);
            }
            i += l;
            done = true;
            break;
          }
        }
      }else if (DOT.includes(src[i])){
        if (isNum){
          ident += src[i];
          advancePosition(src[i]);
          i++;
        }else{
          pushIdent();
          tokens.push({tag:"sigil",value:DOT, line: line, col: col});
          advancePosition(src[i]);
          i++;
        }
      }else if (NUMBER.includes(src[i])){
        if (ident.length == 0){
          isNum = true;

        }
        ident += src[i];
        advancePosition(src[i]);
        i++;
      }else{
        ident += src[i];
        advancePosition(src[i]);
        i++;
      }
    }
    pushIdent();
    newlineMaybe();
    return tokens;
  }


  function tokens2ast(tokens){
    function gtok(i){
      return tokens[i]||{};
    }


    function toksHasVal(toks,val){
      for (var i = 0; i < toks.length; i++){
        if (toks[i].value == val){
          return true;
        }
      }
      return false;
    }

    function tillNestEndImpl(toks,i,l,r){
      let tk = [];
      let lvl = 0;

      while (true){
        if (i >= toks.length){
          return [i,tk]
        }
        if (toks[i].value == l){
          lvl ++;
        }else if (toks[i].value == r){
          if (lvl == 0){
            return [i,tk];
          }
          lvl --;
        }
        tk.push(toks[i]);
        i++;
      }
      return [i,tk];
    }


    function parseExpr(toks){
      

      let i;
      let lvl = 0;
      for (i = 0; i < toks.length; i++){
        if ("{[(".includes(toks[i].value)){
          lvl ++;
        }
        if (")]}".includes(toks[i].value)){
          lvl --;
        }
        if (toks[i].value == ":="){
          if (lvl != 0){
            continue;
          }
          return {
            tag:"declare",
            names:splitToksBy(toks.slice(0,i),",").map(x=>x[0].value),
            value:parseExpr(toks.slice(i+1)),
            type:{tag:"auto"},
            isconst:false,
          }
        }
      }
      lvl = 0;

      for (i = 0; i < toks.length; i++){
        if ("{[(".includes(toks[i].value)){
          lvl ++;
        }
        if (")]}".includes(toks[i].value)){
          lvl --;
        }
        if (toks[i].value == "="){
          if (lvl != 0){
            continue;
          }
          return {
            tag:"assign",
            lhs:parseExpr(toks.slice(0,i)),
            rhs:parseExpr(toks.slice(i+1)),
          }
        }
      }

      // console.log(splitToksBy(toks,","))
      let groups = splitToksBy(toks,",");
      if (groups.length > 1){
        return {
          tag:"tuple",
          items:groups.map(parseExpr),
        }
      }

      let body = [];
      
      i = 0;
      while (i < toks.length){
        function tillNestEnd(l,r){
          let [j,tk] = tillNestEndImpl(toks,i,l,r);
          i = j;
          return tk;
        }

        if (toks[i].value== "("){

          if (i > 0 && (toks[i-1].tag == "ident") && (toks[i-1].value == "make") && (body.length<2 || body[body.length-2].tag != "access") ){

            i++;
            body.pop(); 
            let args = splitToksBy(tillNestEnd("(",")"),",");

            body.push({
              tag:"alloc",
              type:parseType(args[0]),
              size:args[1]?parseExpr(args[1]):null,
            });
            i++;
          }else if (i > 0 && (toks[i-1].tag == "ident" || toks[i-1].value == "]" || toks[i-1].value == "}" || toks[i-1].value == ")")){
            let fun = body.pop();
            if (fun.tag == "ident" && PRIMTYPES.includes(fun.value)){
              i++;
              body.push({
                tag:"cast",
                type:{tag:fun.value},
                value:parseExpr(tillNestEnd("(",")"))
              })
              i++;
            }else{
              i++;
              let startToken = fun.line ? fun : (toks[i-1] || {});
              body.push({
                tag:"call",
                func:fun,
                args:splitToksBy(tillNestEnd("(",")"),",").map(parseExpr),
                line: startToken.line,
                col: startToken.col
              });
              i++;

            }
          }else{
            i++;
            body.push(parseExpr(tillNestEnd("(",")")));
            i++;
          }
        }else if (toks[i].value == "."){
          i++;
          // console.log(toks[i])
          body.push({
            tag:"access",
            struct:body.pop(),
            member:toks[i].value,
          })
          i++;
        }else if (toks[i].value == "["){
          if (i > 0 && (toks[i-1].tag == "ident" || toks[i-1].value == "]")){
            i++;
            let idx = tillNestEnd("[","]");
            let idc = splitToksBy(idx,":");
            // console.log(idc);
            if (idc.length == 1){
              body.push({
                tag:"index",
                container:body.pop(),
                index:parseExpr(idx),
              });
            }else{
              body.push({
                tag:"slice",
                container:body.pop(),
                lo:parseExpr(idc[0]),
                hi:parseExpr(idc[1]),
              });
            }
            i++;
          }else{
            i++;
            let size = tillNestEnd("[","]");
            let mode = 0;
            for (var j = 0; j < toks.length; j++){
              if (toks[j].value == "{"){
                mode = 0;
                break;
              }else if (toks[j].value == "("){
                mode = 1;
                break;
              }
            }
            if (mode==0){
              let lit = {
                tag:"arraylit",
                size:parseExpr(size),
              }
              i++;
              lit.type = parseType(tillNestEnd("}","{"));
              i++;
              lit.items = splitToksBy(tillNestEnd("{","}"),",");
              body.push(lit);
              i++;
            }else{
              i++;
              let type = tillNestEnd(")","(");
              type = parseType(type);
              i++;
              let val =parseExpr(tillNestEnd("(",")"));
              body.push({
                tag:"cast",
                type:{tag:"array",size:parseExpr(size),item:type},
                value:val
              })
              i++;

            }
          }
        
        }else if (toks[i].value == "{"){
          // console.log(toks,i)
          i++;
          let cont = tillNestEnd("{","}");
          cont = splitToksBy(cont,",")
          let fields = [];
          for (let j= 0; j < cont.length; j++){
            let pair = splitToksBy(cont[j],",");
            let lhs = pair[0];
            let rhs = pair[1];
            if (!rhs){
              fields.push({name:null,value:parseExpr(lhs)});
            }else{
              fields.push({name:lhs[0].value,value:parseExpr(rhs)});
            }
          }

          let structType = body.pop();
          let startToken = structType.line ? structType : (toks[i-1] || {});
          body.push({
            tag:"structlit",
            struct:structType,
            fields,
            line: startToken.line,
            col: startToken.col
          });
          i++;

        }else if (toks[i].tag == "sigil" && OPERATOR.includes(toks[i].value)){
          body.push({tag:"op",value:toks[i].value});
          i++;
        }else if (toks[i].tag == "newline"){
          i++;
        }else if (toks[i].value == "func"){
          let stmt = {tag:"lambda"};
          i++;
          i++;
          let args = tillNestEnd("(",")");

          args = parseArgs(args);

          stmt.args = args;
          
          i++;
          stmt.returns = [];
          if (toks[i].value != "{"){
            if (toks[i].value != "("){
              stmt.returns.push({name:null,type:parseType(tillNestEnd("}","{"))});
            }else{
              i++;
              stmt.returns = parseRetTypes(tillNestEnd("(",")"));
              i++;
            }
          }
          i++;
          stmt.body = tokens2ast(tillNestEnd("{","}"));
          body.push(stmt);
          i++;
        }else{
          body.push(toks[i]);
          i++;
        }
      }
      return {tag:"expr",body};
    }
    function parseArgs(toks){

      let args = [];

      let i = 0;

      let lvl = 0;
      while (i < toks.length){
        

        let arg = {};
        arg.name = toks[i].value;
        i++;
        let typ = []
        let lvl = 0;
        while (i < toks.length){
          if (toks[i].value == "("){
            lvl ++;
          }else if (toks[i].value == ")"){
            lvl --;
          }else if (toks[i].value == ","){
            if (lvl == 0){
              break;
            }
          }
          typ.push(toks[i]);
          i++;
        }
        // console.log(typ);
        arg.type = parseType(typ);
        i++;
        args.push(arg);
      
        

      }
      // console.log(args);

      for (i = args.length-1; i >= 0; i--){
        if (args[i].type == undefined){
          args[i].type = args[i+1].type;
        }

      }
      return args;
    }

    function splitToksBy(toks,delim,delim2){
      let groups = [];
      let gp = [];
      let lvl = 0;
      for (let i = 0; i < toks.length; i++){
        if (toks[i].value == "{" || toks[i].value == "(" || toks[i].value == "["){
          lvl ++;
          gp.push(toks[i])
        }else if (toks[i].value == "}" || toks[i].value == ")" || toks[i].value == "]"){
          lvl --;
          gp.push(toks[i])
        }else if (toks[i].value == delim && lvl == 0){
          groups.push(gp);
          gp = [];
        }else if (delim2 != undefined && toks[i].value == delim2 && lvl == 0){
          groups.push(gp);
          gp = [];
        }else{
          gp.push(toks[i])
        }
      }
      if (groups.length || gp.length){
        groups.push(gp);
      }
      return groups;
    }

    function parseRetTypes(toks){
      let items = splitToksBy(toks,",");
      let simple = true;
      for (let j = 0; j < items.length; j++){
        if (items[j].length != 1){
          if (items[j][0].value != "map" && items[j][0].value != "[" && items[j][0].value != "*"){
            simple = false;
          }
          break;
        }
      }
      if (simple){
        return items.map(x=>({name:null,type:parseType(x)}));
      }
      let ret = items.map(x=>({}));

      for (let j = items.length-1; j >= 0 ; j--){
        let name = items[j][0].value;
        let type = items[j].slice(1);
        if (!type.length){
          type = ret[j+1].type;
        }else{
          type = parseType(type);
        }
        ret[j].name = name;
        ret[j].type = type;
      }
      return ret;
    }


    function parseType(toks){

      // return toks.map(x=>x.value).join("");
      if (toks.length == 1){
        return {tag:toks[0].value};
      }
      let i = 0;
      while (i < toks.length){

        function tillNestEnd(l,r){
          let [j,tk] = tillNestEndImpl(toks,i,l,r);
          i = j;
          return tk;
        }

        if (toks[i].value == "["){

          let typ = {tag:"array",size:null,item:null};
          i++;
          typ.size = parseExpr(tillNestEnd("[","]"));
          i++;
          typ.item = parseType(toks.slice(i));
          return typ;

        }else if (toks[i].value == "..."){

          let typ = {tag:"rest",item:null};
          i++;
          typ.item = parseType(toks.slice(i));
          return typ;

        }else if (toks[i].value == "*"){
          return {tag:"ptr",item:parseType(toks.slice(i+1))};

        }else if (toks[i].value == "map"){

          let typ = {tag:"map",key:null,value:null};
          i+=2;

          let te = tillNestEnd("[","]");

          typ.key = parseType(te);

          i++;
          typ.value = parseType(toks.slice(i));

          return typ;
        }else if (toks[i].value == "func"){
          return {tag:"lambda",...parseFuncSig(toks.slice(i+1))};
        }else if (toks[i].value == "interface"){
          return {tag:"interface"};
        }else if (toks[i].value == "<-" && toks[i+1].value == "chan"){
          return {tag:"chan", item:parseType(toks.slice(i+2)), mode:'i'}
        }else if (toks[i].value == "chan" && toks[i+1].value == "<-"){
          return {tag:"chan", item:parseType(toks.slice(i+2)), mode:'o'}
        }else if (toks[i].value == "chan"){
          return {tag:"chan", item:parseType(toks.slice(i+1)), mode:'io'}

        }else if (toks[i+1] && toks[i+1].value == "."){
          
          return {tag:"namespaced",namespace:toks[i].value,item:parseType(toks.slice(i+2))}
        }
      }
    }

    function parseFuncSig(toks){
      let lvl = 0;
      let k;
      for (k = 1; k < toks.length; k++){

        if (toks[k].value == "("){
          lvl ++;
        }else if (toks[k].value == ")"){
          if (lvl == 0){
            break;
          }
          lvl --;
        }

      }

      let args = toks.slice(1,k);

      args = parseRetTypes(args);
      let rets = toks.slice(k+1);
      if (rets.length){
        while(rets[0].value == "("){
          rets = rets.slice(1,-1);
        }
        rets = parseRetTypes(rets);
      }else{
        rets = [];
      }
      return {args:args,returns:rets}
    }


    let tree = [];
    let i = 0;
    while (i < tokens.length){
      // console.log(i,tokens[i])
      function tillStmtEnd(){
        let toks = [];
        let lvl = 0;
        while (true){

          if (i >= tokens.length){
            return toks;
          }
          // if (gtok(i).tag == undefined){
          //   // process.exit();
          // }
          if (gtok(i).tag == "sigil" && gtok(i).value == ";"){
            break;
          }
          if ("[{(".includes(gtok(i).value)){
            lvl++;
          }else if (")}]".includes(gtok(i).value)){
            lvl--;
          }else if (gtok(i).tag == "newline"){
            if (lvl == 0){
              if (gtok(i-1).tag != "sigil" || 
                gtok(i-1).value == ";" || 
                gtok(i-1).value == "++" || 
                gtok(i-1).value == "--" ||
                "}])".includes(gtok(i-1).value)){
                break;
              }
            }
          }
          toks.push(tokens[i]);
          i++;
        }
        return toks;
      }

      function tillNestEnd(l,r){
        let [j,tk] = tillNestEndImpl(tokens,i,l,r);
        i = j;
        return tk;
      }

      if (gtok(i).tag == "ident" && gtok(i).value == "package"){
        tree.push({tag:"package",name:gtok(i+1).value});
        i+=2;
      }else if (gtok(i).tag == "ident" && gtok(i).value == "type"){
        if (gtok(i+2).value == "struct"){
          let stmt = {tag:"typedef",name:gtok(i+1).value,fields:[],embeds:[]};
          i += 4;

          let lns = splitToksBy(tillNestEnd("{","}"),"\n",";");
          for (let j = 0; j < lns.length; j++){
            let names = splitToksBy(lns[j],",");
            if (!names.length){
              continue;
            }
            if (names.length == 1 && names[0].length == 1){
              stmt.embeds.push(names[0][0].value);

            }else{
              let type = names[names.length-1].slice(1);

              type = parseType(type);
              
              for (let k = 0; k < names.length; k++){
                stmt.fields.push({name:names[k][0].value,type});
              }
            }
            
          }
          i++;

          tree.push(stmt);
        }else if (gtok(i+2).value == "interface"){
          let stmt = {tag:"interface",name:gtok(i+1).value,methods:[]};
          i += 4;

          let lns = splitToksBy(tillNestEnd("{","}"),"\n",";");

          for (let j = 0; j < lns.length; j++){

            let name = lns[j][0];
            if (!name){
              continue;
            }
            name = name.value;
            let sig = Object.assign({name},parseFuncSig(lns[j].slice(1)));
            
            stmt.methods.push(sig)
            
          }
          tree.push(stmt);

          i++;
        }else{
          let stmt = {tag:"typealias",name:gtok(i+1).value};
          i += 2;
          let typ = tillStmtEnd();
          stmt.value = parseType(typ);
          tree.push(stmt);
        }
      }else if (gtok(i).tag == "ident" && gtok(i).value == "func"){
        let stmt = {tag:"func",receiver:null};
        if (gtok(i+1).value == "("){
          stmt.receiver = {name:gtok(i+2).value};
          i += 3;
          stmt.receiver.type=parseType(tillNestEnd("(",")"));
        }

        i++;
        stmt.name = gtok(i).value;
        i+=2;
        let args = tillNestEnd("(",")");

        args = parseArgs(args);

        stmt.args = args;
        
        i++;
        stmt.returns = [];
        if (gtok(i).value != "{"){
          if (gtok(i).value != "("){
            stmt.returns.push({name:null,type:parseType(tillNestEnd("}","{"))});
          }else{
            i++;
            stmt.returns = parseRetTypes(tillNestEnd("(",")"));
            i++;
          }
        }
        i++;
        stmt.body = tokens2ast(tillNestEnd("{","}"));
        tree.push(stmt);
        i++;
      }else if (gtok(i).tag == "ident" && gtok(i).value == "if"){
        let stmt = {tag:"if"}
        i+=1;
        let cond = tillNestEnd("}","{");
        let conds = splitToksBy(cond,";");
        stmt.prepare = conds.slice(0,-1).map(parseExpr);
        stmt.condition = parseExpr(conds[conds.length-1]);
        i++;
        stmt.body = tokens2ast(tillNestEnd("{","}")); 
        tree.push(stmt);
        i++;

      }else if (gtok(i).tag == "ident" && gtok(i).value == "else"){
        if (gtok(i+1).tag == "ident" && gtok(i+1).value == "if"){
          let stmt = {tag:"elseif"};
          i += 2;
          let cond = tillNestEnd("}","{");
          stmt.condition = parseExpr(cond);
          i++;
          stmt.body = tokens2ast(tillNestEnd("{","}")); 
          tree.push(stmt);
          i++;
        }else{
          let stmt = {tag:"else"};
          i ++;
          i++;
          stmt.body = tokens2ast(tillNestEnd("{","}")); 
          tree.push(stmt);
          i++;
        }

      }else if (gtok(i).tag == "ident" && gtok(i).value == "for"){
        let stmt = {tag:"for"}
        i+=1;
        let head = tillNestEnd("}","{");

        if (toksHasVal(head,"range")){
          stmt.tag = "foreach";
          let [lhs,rhs] = splitToksBy(head,":=");

          stmt.names = splitToksBy(lhs,",").map(x=>x[0].value);
          stmt.container = parseExpr(rhs.slice(1));
          i++;
        }else{
          stmt.headers = splitToksBy(head,";").map(parseExpr);
          i++;
        }
        stmt.body = tokens2ast(tillNestEnd("{","}")); 
        tree.push(stmt);
        i++;

      }else if (gtok(i).tag == "ident" && (gtok(i).value == "var" || gtok(i).value == "const")){
        let isconst = (gtok(i).value == "const");

        if (gtok(i+1).value == "("){
          i++;
          let toks = tillStmtEnd().slice(1,-1);
          let lns = splitToksBy(toks,"\n",";").filter(x=>x.length);

          let lastval = null;
          let iota = 0;
          function inferval(rhs){
            if (rhs == null){
              if (lastval){
                rhs = lastval.slice();
              }else{
                return null; //probably invalid go, but whatever
              }
            }
            lastval = rhs.slice();
            let diduseiota = false;
            for (let j = 0; j < rhs.length; j++){
              if (rhs[j].value == "iota"){
                rhs[j] = {tag:"number",value:`${iota}`};
                diduseiota = true;
              }
            }
            if (diduseiota){
              iota ++;
            }
            return parseExpr(rhs);
          }
          for (let j = 0; j < lns.length; j++){
            let sides = splitToksBy(lns[j],"=");

            let lhs = sides[0];
            let type = lhs.slice(1);

            if (type.length){
              type = parseType(type);
            }else{
              type = null;
            }
            let rhs = sides[1];
            let stmt = {
              tag:"declare",
              names:[lhs[0].value],
              value:inferval(rhs),
              type:type||{tag:"auto"},
              isconst,
            };
            tree.push(stmt);
          }
          i++;

        }else{

          i++;
          let toks = tillStmtEnd();
          let sides = splitToksBy(toks,"=");
          let lhs = sides[0];
          let rhs = sides[1];

          let names = splitToksBy(lhs,",");


          let type = names[names.length-1].slice(1);

          if (type){
            type = parseType(type);
          }

          names = names.map(x=>x[0].value);
          let stmt = {
            tag:"declare",
            names,
            value:(!rhs)?null:parseExpr(rhs),
            type:type||{tag:"auto"},
            isconst,
          };

          tree.push(stmt);
          i++;
        }
      }else if (gtok(i).tag == "ident" && (gtok(i).value == "switch")){
        let stmt = {tag:"switch"}
        i+=1;
        let cond = tillNestEnd("}","{");
        stmt.condition = parseExpr(cond);
        i++;
        let body = tillNestEnd("{","}"); 

        stmt.cases = [];
        let j = 0;
        let s0=null;
        let s1=null;
        while (j < body.length){
          if (body[j].value=="case" || body[j].value == "default"){
            if (s0 == null){
              s1 = null;
              s0 = [];
            }else{
              if (s0.length){
                stmt.cases.push({
                  tag:"case",
                  condition:parseExpr(s0),
                  body:tokens2ast(s1),
                })
              }else{
                stmt.cases.push({
                  tag:"default",
                  body:tokens2ast(s1),
                })
              }
              s0 = [];
              s1 = null;
            }
          }else if (body[j].value==":"){
            s1 = [];
          }else{
            if (s1 != null){
              s1.push(body[j]);
            }else if (s0 != null){
              s0.push(body[j]);
            }
          }
          j++;
        }
        if (s0 != null){
          if (s0.length){
            stmt.cases.push({
              tag:"case",
              condition:parseExpr(s0),
              body:tokens2ast(s1),
            })
          }else{
            stmt.cases.push({
              tag:"default",
              body:tokens2ast(s1),
            })
          }
        }
        
        tree.push(stmt);
        i++;

      }else if (gtok(i).tag == "newline"){
        i++;
      }else if (gtok(i).tag == "comment"){
        tree.push({tag:"comment",text:gtok(i).value});
        i++;
      }else if (gtok(i).value == "return"){
        i++;
        tree.push({tag:"return",value:parseExpr(tillStmtEnd())})
        i++;
      }else if (gtok(i).value == "import"){
        i++;
        let imps = tillStmtEnd();
        // imps = imps.filter(x=>x.tag!="newline");

        for (let j = 0; j < imps.length-1; j++){
          if (imps[j].tag == "string"){
            tree.push({tag:"import",value:imps[j].value})
          }
        }
        i++;

      }else if (gtok(i).value == "go"){
        i++;
        let e = tillStmtEnd();
        tree.push({tag:"invoke",func:parseExpr(e)})
        i++;
      }else if (gtok(i).value == "defer"){
        i++;
        let e = tillStmtEnd();
        tree.push({tag:"defer",expr:parseExpr(e)})
        i++;
      }else{
        let toks = tillStmtEnd();
        // console.log(toks);
        let stmt = parseExpr(toks);
        if (stmt.tag == "expr"){
          stmt = {
            tag:"exec",
            expr:stmt,
          };
        }
        tree.push(stmt);
        i++;
      }
    }
    return tree;
  }

  function go2ast(src){
    var tokens = go2tokens(src);
    // tokens.map(x=>console.log(x));
    var tree = tokens2ast(tokens);
    return tree;
  }

  this.go2ast = go2ast;
  this.go2tokens = go2tokens;
  this.tokens2ast = tokens2ast;
}

function extractGoAST(src) {
  const parser = new go2json();
  const tokens = parser.go2tokens(src);
  const tree = parser.tokens2ast(tokens);
  return tree;
}

module.exports = { extractGoAST };

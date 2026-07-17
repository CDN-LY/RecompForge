
export default {


async fetch(request,env){


let url =
new URL(request.url);



if(
url.pathname === "/api/recent"
){



let data=[

{
name:"Rahim",
flag:"🇧🇩",
time:"2 minutes ago"
},

{
name:"Alex",
flag:"🇺🇸",
time:"5 minutes ago"
},

{
name:"John",
flag:"🇬🇧",
time:"8 minutes ago"
}

];



return new Response(

JSON.stringify(data),

{
headers:{
"content-type":
"application/json"
}

}

);


}





return new Response(
"API Running"
);



}


}

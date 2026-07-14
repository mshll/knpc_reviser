#include <iostream>
using namespace std;
int main(){
int i;
for(i=0;i<5;i++)
{
switch(i)
{
case 1:
cout << "Orange, ";
break;

case 4:
cout << "Apple, ";
break;

default:
cout << "Tea, ";
break;
}
}
cout << endl;
}
